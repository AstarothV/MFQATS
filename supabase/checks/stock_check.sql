-- Self-check of migration 042 (in-stock products): an order takes pieces off the stock, no stock is refused,
-- a cancellation puts the pieces back. Results are raised at the end, so nothing is kept. Run on a throw-away copy.
DO $$
DECLARE p UUID; o UUID; q INT; av TEXT; ty TEXT; r TEXT := 'STOCK CHECK';
BEGIN
  INSERT INTO public.products (product_ref, name, category, price, stock_type, stock_qty)
  VALUES ('STK-1', 'Stock Chair', 'Chairs', 1000, 'in_stock', 2) RETURNING id INTO p;
  INSERT INTO public.orders (order_ref, pickup_type, product_id, product_name, product_category, quantity, amount, items)
  VALUES ('STK-O1', 'pickup', p, 'Stock Chair', 'Chairs', 2, 2000, jsonb_build_array(jsonb_build_object('product_id', p, 'name', 'Stock Chair', 'quantity', 2)))
  RETURNING id, order_type INTO o, ty;
  SELECT stock_qty, availability INTO q, av FROM public.products WHERE id = p;
  r := r || E'\n' || CASE WHEN ty = 'in_stock' AND q = 0 AND av = 'out_of_stock' THEN 'PASS' ELSE 'FAIL' END || ' order takes stock (' || ty || ', ' || q || ', ' || av || ')';
  BEGIN
    INSERT INTO public.orders (order_ref, pickup_type, product_id, product_name, quantity, items)
    VALUES ('STK-O2', 'pickup', p, 'Stock Chair', 1, jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 1)));
    r := r || E'\nFAIL no stock left but order saved';
  EXCEPTION WHEN others THEN r := r || E'\nPASS no stock -> refused: ' || SQLERRM;
  END;
  UPDATE public.orders SET extended_status = 'cancelled' WHERE id = o;
  SELECT stock_qty, availability INTO q, av FROM public.products WHERE id = p;
  r := r || E'\n' || CASE WHEN q = 2 AND av = 'available' THEN 'PASS' ELSE 'FAIL' END || ' cancel puts stock back (' || q || ', ' || av || ')';
  INSERT INTO public.products (product_ref, name, category, price) VALUES ('MTO-1', 'Made Table', 'Tables', 5000) RETURNING id INTO p;
  INSERT INTO public.orders (order_ref, pickup_type, product_id, product_name, quantity) VALUES ('STK-O3', 'pickup', p, 'Made Table', 1) RETURNING order_type INTO ty;
  r := r || E'\n' || CASE WHEN ty = 'made_to_order' THEN 'PASS' ELSE 'FAIL' END || ' made-to-order product -> ' || ty;
  BEGIN
    INSERT INTO public.products (product_ref, name, category, price) VALUES ('ZERO', 'Free Chair', 'Chairs', 0);
    r := r || E'\nFAIL price 0 saved';
  EXCEPTION WHEN others THEN r := r || E'\nPASS price 0 refused';
  END;
  RAISE EXCEPTION '%', r;
END $$;
