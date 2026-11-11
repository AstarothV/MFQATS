-- "Remember me" for two-step sign-in: after someone enters their 6-digit code with Remember me checked, that browser is
-- trusted for 30 days, and signing in there with the password alone is enough. The database stays in charge: migration
-- 019 refuses data to a session without the code unless mfa_ok() is true, and mfa_ok() now also accepts a session that
-- a trusted browser vouched for. The browser keeps a long random key; only its SHA-256 hash is stored here.
-- A password alone from another browser still needs the code. Turning two-step sign-in off or on again, or
-- "Forget remembered devices" in Profile, removes every trusted browser of that person.
-- Safe to run more than once.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.mfa_trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sign-in sessions a trusted browser vouched for (a session keeps its id when it refreshes; signing out ends it)
CREATE TABLE IF NOT EXISTS private.mfa_trusted_sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);
REVOKE ALL ON private.mfa_trusted_devices, private.mfa_trusted_sessions FROM PUBLIC, anon, authenticated;

-- the session may use data: no verified second factor, or the code was entered, or a trusted browser vouched for it
CREATE OR REPLACE FUNCTION public.mfa_ok()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified')
        OR EXISTS (SELECT 1 FROM private.mfa_trusted_sessions s
                    WHERE s.session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
                      AND s.user_id = auth.uid() AND s.expires_at > now());
$$;

-- after the code was entered (aal2): trust this browser for 30 days; returns the key for the browser to keep
CREATE OR REPLACE FUNCTION public.remember_this_device()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    k TEXT := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
    IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
        RAISE EXCEPTION 'Enter your 6-digit code first';
    END IF;
    DELETE FROM private.mfa_trusted_devices WHERE expires_at <= now();
    INSERT INTO private.mfa_trusted_devices (user_id, key_hash, expires_at)
    VALUES (auth.uid(), encode(sha256(convert_to(k, 'UTF8')), 'hex'), now() + interval '30 days');
    RETURN k;
END;
$$;

-- after the password: a remembered browser shows its key; when it matches, this session needs no code
CREATE OR REPLACE FUNCTION public.use_remembered_device(device_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    until TIMESTAMPTZ;
    sid UUID := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
BEGIN
    IF auth.uid() IS NULL OR sid IS NULL OR COALESCE(device_key, '') = '' THEN
        RETURN false;
    END IF;
    DELETE FROM private.mfa_trusted_sessions WHERE expires_at <= now();
    SELECT d.expires_at INTO until FROM private.mfa_trusted_devices d
     WHERE d.user_id = auth.uid() AND d.key_hash = encode(sha256(convert_to(device_key, 'UTF8')), 'hex') AND d.expires_at > now();
    IF until IS NULL THEN
        RETURN false;
    END IF;
    INSERT INTO private.mfa_trusted_sessions (session_id, user_id, expires_at) VALUES (sid, auth.uid(), until)
    ON CONFLICT (session_id) DO UPDATE SET expires_at = EXCLUDED.expires_at;
    RETURN true;
END;
$$;

-- every browser this person trusted stops being trusted
CREATE OR REPLACE FUNCTION public.forget_remembered_devices()
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM private.mfa_trusted_sessions WHERE user_id = auth.uid();
    DELETE FROM private.mfa_trusted_devices WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.remember_this_device(), public.use_remembered_device(TEXT), public.forget_remembered_devices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remember_this_device(), public.use_remembered_device(TEXT), public.forget_remembered_devices() TO authenticated;
