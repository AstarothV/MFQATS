-- Two-step sign-in (MFA): optional for everyone, but once someone turns it on, their data is only served to a session
-- that also entered the 6-digit code (assurance level aal2). Without this, a password alone could still read the data
-- by calling the database directly, skipping the code screen.
-- Before running: in Supabase, Authentication -> Multi-Factor Authentication -> TOTP (app authenticator) must be on.
-- Safe to run more than once.

-- true when the session may use data: either the person has no verified second factor, or this session passed it
CREATE OR REPLACE FUNCTION public.mfa_ok()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified');
$$;

REVOKE ALL ON FUNCTION public.mfa_ok() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_ok() TO authenticated;

-- a RESTRICTIVE policy is added on top of every existing policy of every table with row level security:
-- the other policies still decide what someone may see; this one only adds "and the code was entered if needed".
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT c.relname
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS require_mfa_when_enrolled ON public.%I', t.relname);
        EXECUTE format(
            'CREATE POLICY require_mfa_when_enrolled ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))', t.relname);
    END LOOP;
END;
$$;
