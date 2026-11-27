-- Self-check of migration 045 (cash only) on a throw-away database. Results are raised at the end, so nothing is kept.
DO $$
DECLARE r TEXT := 'CASH ONLY CHECK'; o UUID; n INT;
BEGIN
  -- 1: online payment is refused
  BEGIN
    INSERT INTO public.orders (order_ref, pickup_type, product_name, quantity, payment_method) VALUES ('C-1', 'pickup', 'Stool', 1, 'online');
    r := r || E'\n' || 'FAIL online payment accepted';
  EXCEPTION WHEN check_violation THEN r := r || E'\n' || 'PASS online payment refused';
  END;
  -- 2-3: cash on delivery and cash at the store still work
  INSERT INTO public.orders (order_ref, pickup_type, product_name, quantity, payment_method) VALUES ('C-2', 'pickup', 'Stool', 1, 'store') RETURNING id INTO o;
  r := r || E'\n' || CASE WHEN o IS NOT NULL THEN 'PASS' ELSE 'FAIL' END || ' pick-up order paid at the store';
  BEGIN
    INSERT INTO public.orders (order_ref, pickup_type, product_name, quantity, payment_method) VALUES ('C-3', 'pickup', 'Stool', 1, 'cod');
    r := r || E'\n' || 'FAIL cash on delivery accepted for a pick-up order';
  EXCEPTION WHEN check_violation THEN r := r || E'\n' || 'PASS cash on delivery only for delivery';
  END;
  -- 4-5: the online-only parts are gone
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND ((table_name = 'shop_settings' AND column_name IN ('gcash_name', 'gcash_number', 'bank_details'))
      OR (table_name = 'orders' AND column_name = 'payment_reference'));
  r := r || E'\n' || CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END || ' GCash, bank and reference columns removed';
  r := r || E'\n' || CASE WHEN to_regprocedure('public.submit_payment_reference(uuid,text)') IS NULL THEN 'PASS' ELSE 'FAIL' END || ' reference function removed';
  RAISE EXCEPTION '%', r;
END $$;
