-- Walk-in customers: people who order at the store. The admin keeps their name, email (optional), mobile number and
-- address; there is no password, so nobody can sign in with this record.
--  1. walk_in_customers, and orders.walk_in_customer_id (the walk-in customer of a store order).
--  2. walk_in_email_on_file(email): the sign-up form asks whether an email belongs to a store customer, to tell them
--     they only need to set a password. It answers yes or no only; no name, number or address is ever returned.
--  3. When an account with the same email is confirmed (the customer opened the link in the confirmation email), the
--     walk-in record is joined to it: its orders and address move to the account and the customer is notified.
--     Joining happens only after confirmation, so typing someone else's email gets nothing.
-- Safe to run more than once.

-- ============================================================ 1. walk-in customers
CREATE TABLE IF NOT EXISTS public.walk_in_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 80),
    email TEXT CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
    phone TEXT NOT NULL DEFAULT '',
    street TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    lat NUMERIC,
    lng NUMERIC,
    linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- the account it was joined to
    linked_at TIMESTAMPTZ,
    created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS walk_in_customers_email ON public.walk_in_customers (lower(email)) WHERE email IS NOT NULL;
ALTER TABLE public.walk_in_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS walk_in_customers_admin ON public.walk_in_customers;
CREATE POLICY walk_in_customers_admin ON public.walk_in_customers FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS walk_in_customers_staff_read ON public.walk_in_customers;
CREATE POLICY walk_in_customers_staff_read ON public.walk_in_customers FOR SELECT TO authenticated
    USING (public.is_staff_or_admin());
DROP POLICY IF EXISTS require_mfa_when_enrolled ON public.walk_in_customers;
CREATE POLICY require_mfa_when_enrolled ON public.walk_in_customers AS RESTRICTIVE FOR ALL TO authenticated
    USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS walk_in_customer_id UUID REFERENCES public.walk_in_customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_walk_in_customer ON public.orders (walk_in_customer_id);

-- ============================================================ 2. is this email a store customer? (yes / no only)
CREATE OR REPLACE FUNCTION public.walk_in_email_on_file(p_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.walk_in_customers
                    WHERE email IS NOT NULL AND lower(email) = lower(btrim(COALESCE(p_email, ''))) AND linked_user_id IS NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.walk_in_email_on_file(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.walk_in_email_on_file(TEXT) TO anon, authenticated;

-- ============================================================ 3. join on a confirmed email
CREATE OR REPLACE FUNCTION public.link_walk_in_customer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    w public.walk_in_customers;
    n INT;
BEGIN
    IF NEW.email IS NULL OR NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL AND OLD.email IS NOT DISTINCT FROM NEW.email THEN RETURN NEW; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id AND role = 'customer') THEN RETURN NEW; END IF;
    SELECT * INTO w FROM public.walk_in_customers
     WHERE email IS NOT NULL AND lower(email) = lower(NEW.email) AND linked_user_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN NEW; END IF;

    UPDATE public.walk_in_customers SET linked_user_id = NEW.id, linked_at = now(), updated_at = now() WHERE id = w.id;
    UPDATE public.orders SET customer_id = NEW.id WHERE walk_in_customer_id = w.id AND customer_id IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF btrim(w.street) <> '' AND btrim(w.city) <> '' AND NOT EXISTS (
        SELECT 1 FROM public.customer_addresses WHERE user_id = NEW.id AND lower(street) = lower(w.street)) THEN
        INSERT INTO public.customer_addresses (user_id, label, street, city, phone, lat, lng)
        VALUES (NEW.id, 'Home', w.street, w.city, w.phone, w.lat, w.lng);
    END IF;
    UPDATE public.user_profiles SET phone = w.phone WHERE id = NEW.id AND COALESCE(phone, '') = '' AND w.phone <> '';
    INSERT INTO public.notifications (user_id, title, message, notification_type)
    VALUES (NEW.id, 'Welcome back',
            CASE WHEN n > 0 THEN format('Your %s order%s from our store %s now in OrderView.', n, CASE WHEN n = 1 THEN '' ELSE 's' END, CASE WHEN n = 1 THEN 'is' ELSE 'are' END)
                 ELSE 'Your details from our store were added to your account.' END,
            'success');
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.link_walk_in_customer() FROM PUBLIC, anon, authenticated;
-- runs after on_auth_user_created (trigger names run in order), so the customer's profile exists
DROP TRIGGER IF EXISTS on_auth_user_link_walk_in ON auth.users;
CREATE TRIGGER on_auth_user_link_walk_in AFTER INSERT OR UPDATE OF email_confirmed_at, email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.link_walk_in_customer();
