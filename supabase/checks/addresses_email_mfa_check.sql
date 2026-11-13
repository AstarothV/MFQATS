-- Self-test for saved delivery addresses and the email sign-in code (migrations 037 and 038). Makes throw-away users,
-- tries each rule, then rolls everything back. Run in the Supabase SQL Editor or on a local copy.
BEGIN;

CREATE TEMP TABLE results (n INT, name TEXT, ok BOOLEAN);

DO $$
DECLARE
    cust UUID := gen_random_uuid();
    s1 UUID := gen_random_uuid();
    a1 UUID; a2 UUID;
    code TEXT;
    failed BOOLEAN;
    ok BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (cust, 'address-test@example.com');
    INSERT INTO public.user_profiles (id, email, full_name, role) VALUES (cust, 'address-test@example.com', 'Test Customer', 'customer')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
    PERFORM set_config('request.jwt.claim.sub', cust::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', cust, 'aal', 'aal1', 'session_id', s1)::text, true);

    -- 1. the first address is the default; 2. a new default replaces it
    INSERT INTO public.customer_addresses (user_id, street, city) VALUES (cust, '12 Rizal St', 'Caloocan') RETURNING id INTO a1;
    INSERT INTO results VALUES (1, 'first address becomes the default', (SELECT is_default FROM public.customer_addresses WHERE id = a1));
    INSERT INTO public.customer_addresses (user_id, street, city, is_default) VALUES (cust, '5 Mabini St', 'Manila', true) RETURNING id INTO a2;
    INSERT INTO results VALUES (2, 'one default address',
        (SELECT count(*) FROM public.customer_addresses WHERE user_id = cust AND is_default) = 1
        AND (SELECT is_default FROM public.customer_addresses WHERE id = a2));

    -- 3. an address needs a street and a city
    BEGIN INSERT INTO public.customer_addresses (user_id, street, city) VALUES (cust, '  ', 'Manila'); failed := false; EXCEPTION WHEN others THEN failed := true; END;
    INSERT INTO results VALUES (3, 'empty street refused', failed);

    -- 4. email code off: no code needed
    INSERT INTO results VALUES (4, 'email code off: no code needed', public.mfa_ok());

    -- 5. a wrong code does not turn it on; the right one does and lets this session in
    INSERT INTO private.email_settings (id, url, secret) VALUES (1, 'https://example.invalid/api/order-email', 'x')
    ON CONFLICT (id) DO NOTHING;  -- a rolled-back test never sends: pg_net sends only after COMMIT
    PERFORM public.send_email_code();
    UPDATE private.email_codes SET code_hash = encode(sha256(convert_to(cust::text || '123456', 'UTF8')), 'hex') WHERE user_id = cust;
    code := '123456';  -- the emailed code is never readable, so the test sets a known one
    ok := NOT public.verify_email_code('000000x', true);
    ok := ok AND public.verify_email_code(code, true);  -- separate statements: the checks below must see its changes
    INSERT INTO results VALUES (5, 'wrong code refused, right code turns it on',
        ok AND (public.my_second_steps() ->> 'email')::boolean AND public.mfa_ok());

    -- 6. the next sign-in (new session) needs a code again
    PERFORM set_config('request.jwt.claims', json_build_object('sub', cust, 'aal', 'aal1', 'session_id', gen_random_uuid())::text, true);
    INSERT INTO results VALUES (6, 'new sign-in: email code needed', NOT public.mfa_ok());

    -- 7. a code can be used once, and asking twice within a minute is refused
    ok := NOT public.verify_email_code(code);
    PERFORM public.send_email_code();
    BEGIN PERFORM public.send_email_code(); failed := false; EXCEPTION WHEN others THEN failed := true; END;
    INSERT INTO results VALUES (7, 'code used once; one code a minute', ok AND failed);

    -- 8. five wrong tries lock the code
    UPDATE private.email_codes SET sent_at = now() - interval '2 minutes' WHERE user_id = cust;
    PERFORM public.send_email_code();
    UPDATE private.email_codes SET code_hash = encode(sha256(convert_to(cust::text || '123456', 'UTF8')), 'hex') WHERE user_id = cust;
    FOR i IN 1..5 LOOP PERFORM public.verify_email_code('99999' || i); END LOOP;
    INSERT INTO results VALUES (8, 'after 5 wrong tries even the right code fails', NOT public.verify_email_code(code));

    -- 9. turning it off from a session that is not let in is refused
    BEGIN PERFORM public.turn_off_email_code(); failed := false; EXCEPTION WHEN others THEN failed := true; END;
    INSERT INTO results VALUES (9, 'cannot turn the email code off without passing it', failed);
END;
$$;

SELECT n, name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result FROM results ORDER BY n;

ROLLBACK;
