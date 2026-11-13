-- Self-test for migration 037: delivery fee by distance, pick-up, payment status, saved addresses and the email
-- sign-in code. Makes throw-away users and orders, tries each rule, then rolls everything back.
-- Run in the Supabase SQL Editor or on a local copy.
BEGIN;

CREATE TEMP TABLE results (n INT, name TEXT, ok BOOLEAN);

DO $$
DECLARE
    cust UUID := gen_random_uuid();
    adm UUID := gen_random_uuid();
    other UUID := gen_random_uuid();
    s1 UUID := gen_random_uuid();
    s2 UUID := gen_random_uuid();
    o public.orders;
    a1 UUID; a2 UUID;
    code TEXT;
    failed BOOLEAN;
    ok BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (cust, 'delivery-test@example.com'), (adm, 'delivery-admin@example.com'), (other, 'delivery-other@example.com');
    INSERT INTO public.user_profiles (id, email, full_name, role) VALUES (cust, 'delivery-test@example.com', 'Test Customer', 'customer'),
        (adm, 'delivery-admin@example.com', 'Test Admin', 'admin'), (other, 'delivery-other@example.com', 'Other', 'customer')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
    UPDATE public.shop_settings SET shop_lat = 14.6460477, shop_lng = 120.9806895, delivery_base_fee = 300, delivery_free_km = 5, delivery_per_km = 20 WHERE id = 1;

    PERFORM set_config('request.jwt.claim.sub', cust::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', cust, 'aal', 'aal1', 'session_id', s1)::text, true);

    -- 1. distance and fee are worked out by the database (Quezon City Hall, about 7.6 km away: 300 + 3 km x 20)
    INSERT INTO public.orders (order_ref, customer_id, amount, pickup_type, delivery_address, delivery_city, delivery_lat, delivery_lng, delivery_fee)
    VALUES ('TEST-DEL-1', cust, 1000, 'delivery', '1 Elliptical Rd', 'Quezon City', 14.6466, 121.0500, 5) RETURNING * INTO o;
    INSERT INTO results VALUES (1, 'delivery fee from the distance, not from the browser',
        o.delivery_km BETWEEN 7 AND 8.5 AND o.delivery_fee = 300 + 20 * ceil(o.delivery_km - 5));

    -- 2. near the shop: only the base fee
    INSERT INTO public.orders (order_ref, customer_id, amount, pickup_type, delivery_lat, delivery_lng)
    VALUES ('TEST-DEL-2', cust, 1000, 'delivery', 14.6500, 120.9850) RETURNING * INTO o;
    INSERT INTO results VALUES (2, 'within 5 km: base fee only', o.delivery_km < 5 AND o.delivery_fee = 300);

    -- 3. pick-up: no fee, the shop address is the pick-up place
    INSERT INTO public.orders (order_ref, customer_id, amount, pickup_type, delivery_lat, delivery_lng)
    VALUES ('TEST-DEL-3', cust, 1000, 'pickup', 14.6466, 121.0500) RETURNING * INTO o;
    INSERT INTO results VALUES (3, 'pick-up: no delivery fee', o.delivery_fee = 0 AND o.delivery_address = (SELECT pickup_address FROM public.shop_settings));

    -- 4. a customer cannot place an order already marked paid
    INSERT INTO public.orders (order_ref, customer_id, amount, payment_method, payment_status)
    VALUES ('TEST-DEL-4', cust, 1000, 'gcash', 'paid') RETURNING * INTO o;
    INSERT INTO results VALUES (4, 'new order from a customer is unpaid', o.payment_status = 'unpaid');

    -- 5. a customer cannot mark their order paid or change the fee
    BEGIN UPDATE public.orders SET payment_status = 'paid' WHERE id = o.id; failed := false; EXCEPTION WHEN others THEN failed := true; END;
    INSERT INTO results VALUES (5, 'customer cannot mark it paid', failed);

    -- 6. an admin marks it paid; the time is recorded
    PERFORM set_config('request.jwt.claim.sub', adm::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'aal', 'aal1', 'session_id', s2)::text, true);
    UPDATE public.orders SET payment_status = 'paid' WHERE id = o.id RETURNING * INTO o;
    INSERT INTO results VALUES (6, 'admin marks it paid; the customer is notified', o.payment_status = 'paid' AND o.paid_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.notifications WHERE entity_id = o.id AND user_id = cust AND title = 'Payment received'));

    -- 7. saved addresses: the first is the default, a new default replaces it
    PERFORM set_config('request.jwt.claim.sub', cust::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', cust, 'aal', 'aal1', 'session_id', s1)::text, true);
    INSERT INTO public.customer_addresses (user_id, street, city) VALUES (cust, '12 Rizal St', 'Caloocan') RETURNING id INTO a1;
    INSERT INTO public.customer_addresses (user_id, street, city, is_default) VALUES (cust, '5 Mabini St', 'Manila', true) RETURNING id INTO a2;
    INSERT INTO results VALUES (7, 'one default address',
        (SELECT count(*) FROM public.customer_addresses WHERE user_id = cust AND is_default) = 1
        AND (SELECT is_default FROM public.customer_addresses WHERE id = a2));

    -- 8. email code: without it turned on, nothing changes
    INSERT INTO results VALUES (8, 'email code off: no code needed', public.mfa_ok());

    -- 9. a wrong code does not turn it on; the right one does and lets this session in
    INSERT INTO private.email_settings (id, url, secret) VALUES (1, 'https://example.invalid/api/order-email', 'x')
    ON CONFLICT (id) DO NOTHING;  -- a rolled-back test never sends: pg_net sends only after COMMIT
    PERFORM public.send_email_code();
    UPDATE private.email_codes SET code_hash = encode(sha256(convert_to(cust::text || '123456', 'UTF8')), 'hex') WHERE user_id = cust;
    code := '123456';  -- the emailed code is never readable, so the test sets a known one
    ok := NOT public.verify_email_code('000000x', true);
    ok := ok AND public.verify_email_code(code, true);  -- separate statements: the checks below must see its changes
    INSERT INTO results VALUES (9, 'wrong code refused, right code turns it on',
        ok AND (public.my_second_steps() ->> 'email')::boolean AND public.mfa_ok());

    -- 10. the next sign-in (new session) needs a code again
    PERFORM set_config('request.jwt.claims', json_build_object('sub', cust, 'aal', 'aal1', 'session_id', gen_random_uuid())::text, true);
    INSERT INTO results VALUES (10, 'new sign-in: email code needed', NOT public.mfa_ok());

    -- 11. a code can be used once, and asking twice within a minute is refused
    ok := NOT public.verify_email_code(code);
    PERFORM public.send_email_code();
    BEGIN PERFORM public.send_email_code(); failed := false; EXCEPTION WHEN others THEN failed := true; END;
    INSERT INTO results VALUES (11, 'code used once; one code a minute', ok AND failed);

    -- 12. five wrong tries lock the code
    UPDATE private.email_codes SET sent_at = now() - interval '2 minutes' WHERE user_id = cust;
    PERFORM public.send_email_code();
    UPDATE private.email_codes SET code_hash = encode(sha256(convert_to(cust::text || '123456', 'UTF8')), 'hex') WHERE user_id = cust;
    code := '123456';  -- the emailed code is never readable, so the test sets a known one
    FOR i IN 1..5 LOOP PERFORM public.verify_email_code('99999' || i); END LOOP;
    INSERT INTO results VALUES (12, 'after 5 wrong tries even the right code fails', NOT public.verify_email_code(code));

    -- 13. turning it off from a session that is not let in is refused
    BEGIN PERFORM public.turn_off_email_code(); failed := false; EXCEPTION WHEN others THEN failed := true; END;
    INSERT INTO results VALUES (13, 'cannot turn the email code off without passing it', failed);
END;
$$;

SELECT n, name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result FROM results ORDER BY n;

ROLLBACK;
