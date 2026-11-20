-- Self-check of migration 044 (walk-in customers): store orders join the account only after the same email
-- is confirmed. Results are raised at the end, so nothing is kept. Run on a throw-away copy.
DO $$
DECLARE w UUID; o UUID; u UUID := gen_random_uuid(); u2 UUID := gen_random_uuid(); cid UUID; r TEXT := 'WALK-IN CHECK'; b BOOLEAN; n INT;
BEGIN
  INSERT INTO public.walk_in_customers (full_name, email, phone, street, city) VALUES ('Ana Cruz', 'Ana@Mail.com', '+63 917 111 2222', '5 Rizal St', 'Caloocan') RETURNING id INTO w;
  INSERT INTO public.orders (order_ref, pickup_type, product_name, quantity, order_source, customer_name, walk_in_customer_id)
  VALUES ('WI-1', 'pickup', 'Stool', 1, 'walk_in', 'Ana Cruz', w) RETURNING id INTO o;
  b := public.walk_in_email_on_file(' ana@mail.com');
  r := r || E'\n' || CASE WHEN b THEN 'PASS' ELSE 'FAIL' END || ' email on file (any case)';
  r := r || E'\n' || CASE WHEN NOT public.walk_in_email_on_file('nobody@mail.com') THEN 'PASS' ELSE 'FAIL' END || ' other email -> no';
  -- signs up, not confirmed yet: nothing joined
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (u, 'ana@mail.com', '{"full_name":"Ana Cruz"}');
  SELECT customer_id INTO cid FROM public.orders WHERE id = o;
  r := r || E'\n' || CASE WHEN cid IS NULL THEN 'PASS' ELSE 'FAIL' END || ' before confirming -> not joined';
  -- opens the confirmation link
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = u;
  SELECT customer_id INTO cid FROM public.orders WHERE id = o;
  SELECT count(*) INTO n FROM public.customer_addresses WHERE user_id = u;
  r := r || E'\n' || CASE WHEN cid = u AND n = 1 AND (SELECT linked_user_id FROM public.walk_in_customers WHERE id = w) = u
                     AND EXISTS (SELECT 1 FROM public.notifications WHERE user_id = u AND title = 'Welcome back') THEN 'PASS' ELSE 'FAIL' END
         || ' confirmed -> order, address joined, notified';
  r := r || E'\n' || CASE WHEN NOT public.walk_in_email_on_file('ana@mail.com') THEN 'PASS' ELSE 'FAIL' END || ' after joining -> not on file';
  -- confirmed at sign-up (Confirm email off) also joins
  INSERT INTO public.walk_in_customers (full_name, email) VALUES ('Ben Reyes', 'ben@mail.com') RETURNING id INTO w;
  INSERT INTO public.orders (order_ref, pickup_type, product_name, quantity, order_source, customer_name, walk_in_customer_id)
  VALUES ('WI-2', 'pickup', 'Desk', 1, 'walk_in', 'Ben Reyes', w) RETURNING id INTO o;
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES (u2, 'ben@mail.com', now());
  SELECT customer_id INTO cid FROM public.orders WHERE id = o;
  r := r || E'\n' || CASE WHEN cid = u2 THEN 'PASS' ELSE 'FAIL' END || ' confirmed at sign-up -> joined';
  RAISE EXCEPTION '%', r;
END $$;
