-- Self-check of migration 040 (registration names, delivery fee, down payment, payment rules) on a throw-away
-- database. Every result is collected and raised at the end, so nothing is kept.
DO $$
DECLARE
  r TEXT := 'MIGRATION 040 CHECK';
  adm UUID := gen_random_uuid(); cus UUID := gen_random_uuid(); x UUID := gen_random_uuid();
  o UUID; o2 UUID; km NUMERIC; fee NUMERIC; dp NUMERIC; ok BOOLEAN; fn TEXT; f1 TEXT; m1 TEXT; l1 TEXT; ph TEXT; st TEXT;
BEGIN
  -- 1-4: delivery fee (defaults: P300 covers the first 5 km, P20 per started km after that)
  r := r || E'\n' || CASE WHEN public.delivery_fee_for(4.9) = 300 THEN 'PASS' ELSE 'FAIL' END || ' 4.9 km -> P300';
  r := r || E'\n' || CASE WHEN public.delivery_fee_for(5.0) = 300 THEN 'PASS' ELSE 'FAIL' END || ' 5.0 km -> P300';
  r := r || E'\n' || CASE WHEN public.delivery_fee_for(5.1) = 320 THEN 'PASS' ELSE 'FAIL' END || ' 5.1 km -> P320 (a started km counts)';
  r := r || E'\n' || CASE WHEN public.delivery_fee_for(7.6) = 360 THEN 'PASS' ELSE 'FAIL' END || ' 7.6 km -> P360';
  -- 5: distance from the shop to itself
  r := r || E'\n' || CASE WHEN public.km_between(14.6460477, 120.9806895, 14.6460477, 120.9806895) = 0 THEN 'PASS' ELSE 'FAIL' END || ' shop to shop -> 0 km';

  -- 6-7: registration keeps the three name parts and the +63 number; an account without an email is refused
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (cus, 'juan@mail.com', '{"first_name":"Juan","middle_name":"Santos","last_name":"Dela Cruz","phone":"+63 917 123 4567"}');
  SELECT full_name, first_name, middle_name, last_name, phone INTO fn, f1, m1, l1, ph FROM public.user_profiles WHERE id = cus;
  r := r || E'\n' || CASE WHEN fn = 'Juan Santos Dela Cruz' AND f1 = 'Juan' AND m1 = 'Santos' AND l1 = 'Dela Cruz' AND ph = '+63 917 123 4567'
                     THEN 'PASS' ELSE 'FAIL' END || ' sign-up -> first, middle, last name and mobile number saved';
  BEGIN
    INSERT INTO auth.users (id, email) VALUES (x, NULL);
    r := r || E'\n' || 'FAIL account without an email accepted';
  EXCEPTION WHEN others THEN r := r || E'\n' || 'PASS account without an email refused';
  END;

  -- 8: pick-up order: no delivery fee, down payment = 50% of the amount, unpaid
  INSERT INTO public.orders (order_ref, customer_id, pickup_type, product_name, quantity, amount)
  VALUES ('T040-1', cus, 'pickup', 'Stool', 1, 3200) RETURNING id INTO o;
  SELECT delivery_fee, down_payment, payment_status INTO fee, dp, st FROM public.orders WHERE id = o;
  r := r || E'\n' || CASE WHEN fee = 0 AND dp = 1600 AND st = 'unpaid' THEN 'PASS' ELSE 'FAIL' END || ' pick-up: fee 0, down payment P1,600 of P3,200, unpaid';

  -- 9: delivery order with a pin: distance, fee and down payment worked out by the database
  INSERT INTO public.orders (order_ref, customer_id, pickup_type, product_name, quantity, amount, delivery_lat, delivery_lng)
  VALUES ('T040-2', cus, 'delivery', 'Bed Frame', 1, 12000, 14.6500, 121.0500) RETURNING id INTO o2;
  SELECT delivery_km, delivery_fee, down_payment INTO km, fee, dp FROM public.orders WHERE id = o2;
  r := r || E'\n' || CASE WHEN km = public.km_between(14.6460477, 120.9806895, 14.6500, 121.0500)
                          AND fee = public.delivery_fee_for(km) AND dp = round((12000 + fee) * 0.5)
                     THEN 'PASS' ELSE 'FAIL' END || format(' delivery: %s km, fee P%s, down payment P%s', km, fee, dp);

  -- 10: delivery without a pinned address is refused
  BEGIN
    INSERT INTO public.orders (order_ref, customer_id, pickup_type, product_name, quantity, amount) VALUES ('T040-3', cus, 'delivery', 'Desk', 1, 5000);
    r := r || E'\n' || 'FAIL delivery without a pin accepted';
  EXCEPTION WHEN others THEN r := r || E'\n' || 'PASS delivery without a pinned address refused';
  END;

  -- 11: the customer cannot mark their own payment as received
  PERFORM set_config('request.jwt.claim.sub', cus::text, true);
  BEGIN
    UPDATE public.orders SET payment_status = 'down_paid' WHERE id = o;
    SELECT payment_status INTO st FROM public.orders WHERE id = o;
    r := r || E'\n' || CASE WHEN st = 'unpaid' THEN 'PASS customer cannot mark a payment (not changed)' ELSE 'FAIL customer marked a payment' END;
  EXCEPTION WHEN others THEN r := r || E'\n' || 'PASS customer cannot mark a payment (refused)';
  END;

  -- 12-13: the admin cannot confirm an order before its down payment, and can after marking it received
  PERFORM set_config('request.jwt.claim.sub', '', true);       -- set-up as the database itself, not as a user
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (adm, 'boss@mail.com', '{"full_name":"Boss"}');
  UPDATE public.user_profiles SET role = 'admin' WHERE id = adm;
  PERFORM set_config('request.jwt.claim.sub', adm::text, true);
  BEGIN
    UPDATE public.orders SET extended_status = 'confirmed' WHERE id = o;
    r := r || E'\n' || 'FAIL confirmed before the down payment';
  EXCEPTION WHEN others THEN r := r || E'\n' || 'PASS cannot confirm before the down payment is received';
  END;
  UPDATE public.orders SET payment_status = 'down_paid' WHERE id = o;
  UPDATE public.orders SET extended_status = 'confirmed' WHERE id = o;
  SELECT extended_status::text, (down_paid_at IS NOT NULL) INTO st, ok FROM public.orders WHERE id = o;
  r := r || E'\n' || CASE WHEN st = 'confirmed' AND ok THEN 'PASS' ELSE 'FAIL' END || ' down payment marked by the admin -> confirmed, time recorded';
  -- 14: full payment recorded with its time
  UPDATE public.orders SET payment_status = 'paid' WHERE id = o;
  SELECT (paid_at IS NOT NULL) INTO ok FROM public.orders WHERE id = o;
  r := r || E'\n' || CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END || ' full payment marked -> paid time recorded';
  RAISE EXCEPTION '%', r;
END $$;
