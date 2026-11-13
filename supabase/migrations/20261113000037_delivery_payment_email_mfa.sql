-- Delivery, payment method and email sign-in codes.
--  1. shop_settings: the shop's pick-up address and position, the delivery rates and where customers pay (admin edits).
--  2. customer_addresses: a customer's saved delivery addresses, each with its map position.
--  3. orders: pick-up or delivery, the distance and delivery fee (worked out here, not by the browser), the payment
--     method and reference number, and whether the shop has received the payment (only an admin can mark it paid).
--     No money moves through the system: the customer pays by cash, GCash or bank transfer and the admin confirms it.
--  4. Two-step sign-in by email: besides the authenticator app, a person can get a 6-digit code by email. The code is
--     made and checked here and emailed through /api/order-email (the same secret as order emails, migration 032),
--     so nobody can read a code without the inbox. mfa_ok() (migrations 019 and 034) now also asks for it.
-- Safe to run more than once.

-- ============================================================ 1. shop settings
CREATE TABLE IF NOT EXISTS public.shop_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    pickup_address TEXT NOT NULL DEFAULT '202 C. Cordero St., Caloocan, 1400 Metro Manila',
    shop_lat NUMERIC NOT NULL DEFAULT 14.6460477,      -- C. Cordero St., Grace Park West, Caloocan (OpenStreetMap)
    shop_lng NUMERIC NOT NULL DEFAULT 120.9806895,
    delivery_base_fee NUMERIC NOT NULL DEFAULT 300 CHECK (delivery_base_fee >= 0),  -- covers the first free_km
    delivery_free_km NUMERIC NOT NULL DEFAULT 5 CHECK (delivery_free_km >= 0),
    delivery_per_km NUMERIC NOT NULL DEFAULT 20 CHECK (delivery_per_km >= 0),       -- each km after that
    gcash_name TEXT NOT NULL DEFAULT '',
    gcash_number TEXT NOT NULL DEFAULT '',
    bank_details TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.shop_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_settings_read ON public.shop_settings;
CREATE POLICY shop_settings_read ON public.shop_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS shop_settings_admin ON public.shop_settings;
CREATE POLICY shop_settings_admin ON public.shop_settings FOR UPDATE TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- straight-line distance in km between two map positions (haversine), and the fee for it
CREATE OR REPLACE FUNCTION public.km_between(lat1 NUMERIC, lng1 NUMERIC, lat2 NUMERIC, lng2 NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
    SELECT round((2 * 6371 * asin(sqrt(
        power(sin(radians((lat2 - lat1)::float8) / 2), 2) +
        cos(radians(lat1::float8)) * cos(radians(lat2::float8)) * power(sin(radians((lng2 - lng1)::float8) / 2), 2)
    )))::numeric, 1)
$$;

CREATE OR REPLACE FUNCTION public.delivery_fee_for(km NUMERIC)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT round(s.delivery_base_fee + s.delivery_per_km * ceil(greatest(km - s.delivery_free_km, 0)))
      FROM public.shop_settings s WHERE s.id = 1
$$;

-- ============================================================ 2. saved addresses
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Home',
    street TEXT NOT NULL CHECK (length(trim(street)) > 0),
    city TEXT NOT NULL CHECK (length(trim(city)) > 0),
    phone TEXT NOT NULL DEFAULT '',
    lat NUMERIC,
    lng NUMERIC,
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

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS preferred_payment TEXT;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_preferred_payment;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_preferred_payment
    CHECK (preferred_payment IS NULL OR preferred_payment IN ('cash', 'gcash', 'bank_transfer'));

-- ============================================================ 3. orders: pick-up / delivery and payment
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_type TEXT NOT NULL DEFAULT 'delivery',
    ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC,
    ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC,
    ADD COLUMN IF NOT EXISTS delivery_km NUMERIC,
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
-- the live table already had payment_status (and maybe pickup_type / payment_method) from before, with other values
-- such as 'pending': make them plain text and map the old values onto the new ones before the rules are added
DO $$
DECLARE c TEXT;
BEGIN
    FOREACH c IN ARRAY ARRAY['payment_status', 'pickup_type', 'payment_method'] LOOP
        IF (SELECT data_type FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = c) <> 'text' THEN
            EXECUTE format('ALTER TABLE public.orders ALTER COLUMN %I DROP DEFAULT', c);
            EXECUTE format('ALTER TABLE public.orders ALTER COLUMN %I TYPE TEXT USING %I::TEXT', c, c);
        END IF;
    END LOOP;
END;
$$;
UPDATE public.orders SET payment_status = CASE WHEN lower(trim(payment_status)) IN ('paid', 'completed', 'complete') THEN 'paid' ELSE 'unpaid' END
 WHERE payment_status IS NULL OR payment_status NOT IN ('unpaid', 'paid');
UPDATE public.orders SET pickup_type = CASE WHEN lower(pickup_type) ~ 'pick' THEN 'pickup' ELSE 'delivery' END
 WHERE pickup_type IS NULL OR pickup_type NOT IN ('delivery', 'pickup');
UPDATE public.orders SET payment_method = CASE
        WHEN lower(payment_method) ~ 'gcash' THEN 'gcash'
        WHEN lower(payment_method) ~ 'bank' THEN 'bank_transfer'
        WHEN lower(payment_method) ~ 'cash|cod' THEN 'cash' END
 WHERE payment_method IS NOT NULL AND payment_method NOT IN ('cash', 'gcash', 'bank_transfer');
ALTER TABLE public.orders ALTER COLUMN payment_status SET DEFAULT 'unpaid';
ALTER TABLE public.orders ALTER COLUMN payment_status SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN pickup_type SET DEFAULT 'delivery';
ALTER TABLE public.orders ALTER COLUMN pickup_type SET NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_pickup_type;
ALTER TABLE public.orders ADD CONSTRAINT orders_pickup_type CHECK (pickup_type IN ('delivery', 'pickup'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method
    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'gcash', 'bank_transfer'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status CHECK (payment_status IN ('unpaid', 'paid'));

-- the fee is worked out here from the delivery position, never taken from the browser; only an admin marks payment
CREATE OR REPLACE FUNCTION public.order_delivery_and_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    s public.shop_settings;
BEGIN
    IF TG_OP = 'INSERT' OR NEW.pickup_type IS DISTINCT FROM OLD.pickup_type
       OR NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat OR NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng THEN
        SELECT * INTO s FROM public.shop_settings WHERE id = 1;
        IF NEW.pickup_type = 'pickup' THEN
            NEW.delivery_km := NULL;
            NEW.delivery_fee := 0;
            NEW.delivery_address := COALESCE(s.pickup_address, '');
            NEW.delivery_city := 'Pick-up at the shop';
        ELSIF NEW.delivery_lat IS NOT NULL AND NEW.delivery_lng IS NOT NULL THEN
            NEW.delivery_km := public.km_between(s.shop_lat, s.shop_lng, NEW.delivery_lat, NEW.delivery_lng);
            NEW.delivery_fee := public.delivery_fee_for(NEW.delivery_km);
        ELSIF TG_OP = 'INSERT' THEN
            NEW.delivery_km := NULL;
            NEW.delivery_fee := 0;  -- address without a map position: the shop confirms the fee
        END IF;
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NOT public.is_admin() THEN NEW.payment_status := 'unpaid'; NEW.paid_at := NULL; END IF;
    ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
          AND NEW.delivery_lat IS NOT DISTINCT FROM OLD.delivery_lat AND NEW.pickup_type IS NOT DISTINCT FROM OLD.pickup_type THEN
        IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only the shop can change the payment status or the delivery fee'; END IF;
        NEW.paid_at := CASE WHEN NEW.payment_status = 'paid' THEN COALESCE(NEW.paid_at, now()) ELSE NULL END;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_order_delivery_and_payment ON public.orders;
CREATE TRIGGER trg_order_delivery_and_payment BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.order_delivery_and_payment();

-- the customer is told (bell and email, migration 032) when the shop marks the payment received or sets the fee
CREATE OR REPLACE FUNCTION public.notify_payment_and_fee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;
    IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (NEW.customer_id, 'Payment received',
                format('We received your payment for order %s (%s). Thank you!', NEW.order_ref, COALESCE(NEW.product_name, 'your furniture')),
                'success', 'orders', NEW.id);
    ELSIF NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee AND NEW.pickup_type = 'delivery' AND OLD.delivery_km IS NULL AND NEW.delivery_km IS NULL THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (NEW.customer_id, 'Delivery fee set',
                format('The delivery fee for order %s (%s) is ₱%s, so the total is ₱%s.', NEW.order_ref, COALESCE(NEW.product_name, 'your furniture'),
                       to_char(NEW.delivery_fee, 'FM999,999,990'), to_char(COALESCE(NEW.amount, 0) + NEW.delivery_fee, 'FM999,999,990')),
                'info', 'orders', NEW.id);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_payment_and_fee() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_payment_and_fee ON public.orders;
CREATE TRIGGER trg_notify_payment_and_fee AFTER UPDATE OF payment_status, delivery_fee ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_payment_and_fee();

-- ============================================================ 4. two-step sign-in by email
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
    public.turn_off_email_code(), public.remember_this_device(), public.forget_remembered_devices(),
    public.delivery_fee_for(NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_ok(), public.my_second_steps(), public.send_email_code(), public.verify_email_code(TEXT, BOOLEAN),
    public.turn_off_email_code(), public.remember_this_device(), public.forget_remembered_devices(),
    public.delivery_fee_for(NUMERIC) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.order_delivery_and_payment(), public.one_default_address() FROM PUBLIC, anon, authenticated;

-- the two new tables get the same "code entered if needed" rule as every other table (migration 019)
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['shop_settings', 'customer_addresses'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS require_mfa_when_enrolled ON public.%I', t);
        EXECUTE format('CREATE POLICY require_mfa_when_enrolled ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                       'USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))', t);
    END LOOP;
END;
$$;
