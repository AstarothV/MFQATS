-- Self-check of migration 043: only an archived product can be deleted, and its orders keep the product name.
-- Results are raised at the end, so nothing is kept. Run on a throw-away copy.
DO $$
DECLARE p UUID; o UUID; r TEXT := 'DELETE CHECK'; pid UUID; nm TEXT;
BEGIN
  INSERT INTO public.products (product_ref, name, category, price) VALUES ('DEL-1', 'Old Stool', 'Chairs', 500) RETURNING id INTO p;
  INSERT INTO public.orders (order_ref, pickup_type, product_id, product_name, quantity) VALUES ('DEL-O1', 'pickup', p, 'Old Stool', 1) RETURNING id INTO o;
  BEGIN DELETE FROM public.products WHERE id = p; r := r || E'\nFAIL product in the shop was deleted';
  EXCEPTION WHEN others THEN r := r || E'\nPASS in the shop -> refused: ' || SQLERRM; END;
  UPDATE public.products SET is_active = false WHERE id = p;
  DELETE FROM public.products WHERE id = p;
  SELECT product_id, product_name INTO pid, nm FROM public.orders WHERE id = o;
  r := r || E'\n' || CASE WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE id = p) AND pid IS NULL AND nm = 'Old Stool' THEN 'PASS' ELSE 'FAIL' END
         || ' archived -> deleted; the order keeps "' || nm || '"';
  RAISE EXCEPTION '%', r;
END $$;
