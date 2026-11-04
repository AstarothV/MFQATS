-- Roles in the database rules come from user_profiles, the same place the website reads them.
--
-- Before this, is_admin() / is_staff_or_admin() read the role from the login's metadata (auth.users.raw_user_meta_data).
--   1. The two could disagree: an admin in user_profiles whose metadata said otherwise saw only their own row in
--      User Management (and empty lists elsewhere), while the website still let them into the admin pages.
--   2. Any signed-in user can change their own login metadata (supabase.auth.updateUser), so a customer could make
--      the database treat them as an admin.
-- Also: a user may still edit their own profile, but not their own role or whether the account is active, and a new
-- sign-up can no longer give itself the admin role. A deactivated account loses staff/admin access.
-- Safe to run again.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() AND is_active
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.get_user_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.get_user_role() IN ('admin', 'staff'), false)
$$;

-- Only an admin changes a role or (de)activates an account. Changes made in the SQL Editor (no signed-in user) pass.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin()
       AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
        RAISE EXCEPTION 'Only an admin can change a role or deactivate an account';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.user_profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- New accounts: customers sign themselves up; staff accounts come from the admin's Add Staff form. Nobody gets the
-- admin role by signing up (an admin is made by another admin, in User Management).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        (CASE WHEN NEW.raw_user_meta_data->>'role' = 'staff' THEN 'staff' ELSE 'customer' END)::public.user_role,
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
