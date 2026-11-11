-- Self-test for "Remember me" with two-step sign-in (migration 034). Makes a throw-away user with a verified
-- authenticator, tries the sign-in cases, then rolls everything back. Run in the Supabase SQL Editor or on a local copy.
BEGIN;

CREATE TEMP TABLE results (n INT, name TEXT, ok BOOLEAN);

DO $$
DECLARE
    u UUID := gen_random_uuid();
    other UUID := gen_random_uuid();
    s1 UUID := gen_random_uuid();  -- session that entered the code
    s2 UUID := gen_random_uuid();  -- later sign-in on the same browser, password only
    s3 UUID := gen_random_uuid();  -- sign-in on another browser, password only
    k TEXT;
    ok BOOLEAN;
    failed BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (u, 'remember-test@example.com'), (other, 'remember-other@example.com');
    INSERT INTO auth.mfa_factors (user_id, status, factor_type) VALUES (u, 'verified', 'totp');

    -- 1. password only, no remembered browser: the code is still needed
    PERFORM set_config('request.jwt.claim.sub', u::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'aal', 'aal1', 'session_id', s2)::text, true);
    INSERT INTO results VALUES (1, 'password only: code still needed', NOT public.mfa_ok());

    -- 2. a password-only session cannot make itself remembered
    BEGIN PERFORM public.remember_this_device(); failed := false; EXCEPTION WHEN others THEN failed := true; END;
    INSERT INTO results VALUES (2, 'password only cannot remember the browser', failed);

    -- 3. after the code (aal2), the browser is remembered and gets a key
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'aal', 'aal2', 'session_id', s1)::text, true);
    k := public.remember_this_device();
    INSERT INTO results VALUES (3, 'code entered: browser remembered', length(k) = 64
        AND NOT EXISTS (SELECT 1 FROM private.mfa_trusted_devices WHERE key_hash = k)); -- only the hash is stored

    -- 4. a wrong key does not help
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'aal', 'aal1', 'session_id', s3)::text, true);
    ok := public.use_remembered_device('not-the-key');
    INSERT INTO results VALUES (4, 'other browser, wrong key: code still needed', NOT ok AND NOT public.mfa_ok());

    -- 5. the remembered browser, password only: no code needed
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'aal', 'aal1', 'session_id', s2)::text, true);
    ok := public.use_remembered_device(k);
    INSERT INTO results VALUES (5, 'remembered browser: no code needed', ok AND public.mfa_ok());

    -- 6. another account cannot use this key
    PERFORM set_config('request.jwt.claim.sub', other::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', other, 'aal', 'aal1', 'session_id', gen_random_uuid())::text, true);
    INSERT INTO results VALUES (6, 'key does not work for another account', NOT public.use_remembered_device(k));

    -- 7. forgetting the devices ends it, also for the session already let in
    PERFORM set_config('request.jwt.claim.sub', u::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'aal', 'aal1', 'session_id', s2)::text, true);
    PERFORM public.forget_remembered_devices();
    INSERT INTO results VALUES (7, 'forget remembered devices: code needed again', NOT public.mfa_ok() AND NOT public.use_remembered_device(k));

    -- 8. an expired remembered browser is not trusted
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'aal', 'aal2', 'session_id', s1)::text, true);
    k := public.remember_this_device();
    UPDATE private.mfa_trusted_devices SET expires_at = now() - interval '1 minute' WHERE user_id = u;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'aal', 'aal1', 'session_id', gen_random_uuid())::text, true);
    INSERT INTO results VALUES (8, 'after 30 days: code needed again', NOT public.use_remembered_device(k));
END;
$$;

SELECT n, name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result FROM results ORDER BY n;

ROLLBACK;
