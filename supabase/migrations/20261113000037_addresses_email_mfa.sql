-- Saved delivery addresses and email sign-in codes.
-- (Its first version also added payment, pick-up or delivery and the delivery fee; they were taken out again and are
-- now made by migration 040, with the down payment.)
--  1. customer_addresses: a customer's saved delivery addresses (the map position is added by migration 040).
--  2. Two-step sign-in by email: besides the authenticator app, a person can get a 6-digit code by email. The code is
--     made and checked here and emailed through /api/order-email (the same secret as order emails, migration 032),
--     so nobody can read a code without the inbox. mfa_ok() (migrations 019 and 034) now also asks for it.
-- Safe to run more than once.

-- ============================================================ 1. saved addresses
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Home',
    street TEXT NOT NULL CHECK (length(trim(street)) > 0),
    city TEXT NOT NULL CHECK (length(trim(city)) > 0),
    phone TEXT NOT NULL DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_addresses_user ON public.customer_addresses (user_id);
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_addresses_own ON public.customer_addresses;
CREATE POLICY customer_addresses_own ON public.customer_addresses FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS customer_addresses_staff_read ON public.customer_addresses;
CREATE POLICY customer_addresses_staff_read ON public.customer_addresses FOR SELECT TO authenticated
    USING (public.is_staff_or_admin());

-- one default address per person
CREATE OR REPLACE FUNCTION public.one_default_address()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.is_default THEN
        UPDATE public.customer_addresses SET is_default = false WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default;
    ELSIF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM public.customer_addresses WHERE user_id = NEW.user_id AND is_default) THEN
        NEW.is_default := true;  -- the first address is the default
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_one_default_address ON public.customer_addresses;
CREATE TRIGGER trg_one_default_address BEFORE INSERT OR UPDATE OF is_default ON public.customer_addresses
    FOR EACH ROW EXECUTE FUNCTION public.one_default_address();

-- ============================================================ 2. two-step sign-in by email
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS private.email_mfa (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS private.email_codes (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON private.email_mfa, private.email_codes FROM PUBLIC, anon, authenticated;

-- the session may use data: no second step turned on, or this session passed it (app code = aal2, or a remembered
-- browser / an email code vouched for it in mfa_trusted_sessions)
CREATE OR REPLACE FUNCTION public.mfa_ok()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
    SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        OR (NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified')
            AND NOT EXISTS (SELECT 1 FROM private.email_mfa e WHERE e.user_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM private.mfa_trusted_sessions s
                    WHERE s.session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
                      AND s.user_id = auth.uid() AND s.expires_at > now());
$$;

-- which second steps this person has: {"app": true/false, "email": true/false}
CREATE OR REPLACE FUNCTION public.my_second_steps()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
    SELECT jsonb_build_object(
        'app', EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified'),
        'email', EXISTS (SELECT 1 FROM private.email_mfa e WHERE e.user_id = auth.uid()))
$$;

-- email a new 6-digit code to the signed-in person (at most one a minute); the code itself never leaves the database
-- except in that email
CREATE OR REPLACE FUNCTION public.send_email_code()
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
    s private.email_settings;
    u auth.users;
    code TEXT;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
    IF EXISTS (SELECT 1 FROM private.email_codes c WHERE c.user_id = auth.uid() AND c.sent_at > now() - interval '60 seconds') THEN
        RAISE EXCEPTION 'Please wait a minute before asking for another code';
    END IF;
    SELECT * INTO s FROM private.email_settings WHERE id = 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Email is not set up yet (migration 032)'; END IF;
    SELECT * INTO u FROM auth.users WHERE id = auth.uid();
    code := lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
    INSERT INTO private.email_codes (user_id, code_hash, expires_at, attempts, sent_at)
    VALUES (u.id, encode(sha256(convert_to(u.id::text || code, 'UTF8')), 'hex'), now() + interval '10 minutes', 0, now())
    ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = now();
    PERFORM net.http_post(
        url := s.url,
        body := jsonb_build_object('kind', 'signin_code', 'to', u.email,
                                   'name', (SELECT full_name FROM public.user_profiles WHERE id = u.id), 'code', code),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', s.secret),
        timeout_milliseconds := 10000
    );
END;
$$;

-- check an emailed code (5 tries, 10 minutes). Right: this session is let in for 30 days (until sign-out), and with
-- turn_on the person's email second step is switched on.
CREATE OR REPLACE FUNCTION public.verify_email_code(code TEXT, turn_on BOOLEAN DEFAULT false)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
    c private.email_codes;
    sid UUID := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
BEGIN
    IF auth.uid() IS NULL OR sid IS NULL THEN RETURN false; END IF;
    SELECT * INTO c FROM private.email_codes WHERE user_id = auth.uid();
    IF NOT FOUND OR c.expires_at <= now() OR c.attempts >= 5 THEN RETURN false; END IF;
    IF c.code_hash <> encode(sha256(convert_to(auth.uid()::text || COALESCE(trim(code), ''), 'UTF8')), 'hex') THEN
        UPDATE private.email_codes SET attempts = attempts + 1 WHERE user_id = auth.uid();
        RETURN false;
    END IF;
    DELETE FROM private.email_codes WHERE user_id = auth.uid();
    INSERT INTO private.mfa_trusted_sessions (session_id, user_id, expires_at) VALUES (sid, auth.uid(), now() + interval '30 days')
    ON CONFLICT (session_id) DO UPDATE SET expires_at = EXCLUDED.expires_at;
    IF turn_on THEN
        INSERT INTO private.email_mfa (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN true;
END;
$$;

-- switch the email second step off (only from a session that is already let in)
CREATE OR REPLACE FUNCTION public.turn_off_email_code()
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.mfa_ok() THEN RAISE EXCEPTION 'Sign in with your code first'; END IF;
    DELETE FROM private.email_mfa WHERE user_id = auth.uid();
END;
$$;

-- Remember me also works after an email code (migration 034 only accepted the app code)
CREATE OR REPLACE FUNCTION public.remember_this_device()
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    k TEXT := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
    IF auth.uid() IS NULL OR NOT (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2' OR EXISTS (
        SELECT 1 FROM private.mfa_trusted_sessions s
         WHERE s.session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid AND s.user_id = auth.uid() AND s.expires_at > now())) THEN
        RAISE EXCEPTION 'Enter your 6-digit code first';
    END IF;
    DELETE FROM private.mfa_trusted_devices WHERE expires_at <= now();
    INSERT INTO private.mfa_trusted_devices (user_id, key_hash, expires_at)
    VALUES (auth.uid(), encode(sha256(convert_to(k, 'UTF8')), 'hex'), now() + interval '30 days');
    RETURN k;
END;
$$;

-- forgetting devices keeps the current session signed in (it already passed the second step)
CREATE OR REPLACE FUNCTION public.forget_remembered_devices()
RETURNS VOID LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
    DELETE FROM private.mfa_trusted_sessions
     WHERE user_id = auth.uid() AND session_id IS DISTINCT FROM NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
    DELETE FROM private.mfa_trusted_devices WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.mfa_ok(), public.my_second_steps(), public.send_email_code(), public.verify_email_code(TEXT, BOOLEAN),
    public.turn_off_email_code(), public.remember_this_device(), public.forget_remembered_devices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_ok(), public.my_second_steps(), public.send_email_code(), public.verify_email_code(TEXT, BOOLEAN),
    public.turn_off_email_code(), public.remember_this_device(), public.forget_remembered_devices() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.one_default_address() FROM PUBLIC, anon, authenticated;

-- the new table gets the same "code entered if needed" rule as every other table (migration 019)
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['customer_addresses'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS require_mfa_when_enrolled ON public.%I', t);
        EXECUTE format('CREATE POLICY require_mfa_when_enrolled ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                       'USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))', t);
    END LOOP;
END;
$$;
