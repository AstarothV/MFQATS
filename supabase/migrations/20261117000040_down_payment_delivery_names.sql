-- Panel revisions (November 2026): payment with a down payment, pick-up or delivery with a fee by distance, saved
-- addresses pinned on the map, and the customer's name in parts.
--  1. shop_settings: the shop's pick-up address and map position, the delivery rates, the down payment percent and
--     where customers pay online (GCash, bank). Only an admin edits it.
--  2. customer_addresses: the map position (pin) of each saved address. Delivery needs a pinned address.
--  3. orders: pick-up or delivery, the distance and delivery fee, the down payment (all worked out here, never taken
--     from the browser), how the balance is paid (cash on delivery, at the store, or online), the payment reference
--     and the payment status (unpaid -> down payment received -> fully paid). Only an admin marks payments. No money
--     moves through the system.
--  4. Work starts after the down payment: an order cannot move from Pending to Confirmed until the admin marks the
--     down payment as received.
--  5. user_profiles: first, middle (optional) and last name; full_name is kept (made from the parts) because the rest
--     of the system reads it. The phone number given at sign-up is saved too.
-- Safe to run more than once.

-- ============================================================ 1. shop settings
CREATE TABLE IF NOT EXISTS public.shop_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    pickup_address TEXT NOT NULL DEFAULT '202 C. Cordero St., Caloocan, 1400 Metro Manila',
    shop_lat NUMERIC NOT NULL DEFAULT 14.6460477,
    shop_lng NUMERIC NOT NULL DEFAULT 120.9806895,
    delivery_base_fee NUMERIC NOT NULL DEFAULT 300 CHECK (delivery_base_fee >= 0),  -- covers the first free_km
    delivery_free_km NUMERIC NOT NULL DEFAULT 5 CHECK (delivery_free_km >= 0),
    delivery_per_km NUMERIC NOT NULL DEFAULT 20 CHECK (delivery_per_km >= 0),       -- each started km after that
    down_payment_percent NUMERIC NOT NULL DEFAULT 50 CHECK (down_payment_percent BETWEEN 0 AND 100),
    gcash_name TEXT NOT NULL DEFAULT '',
    gcash_number TEXT NOT NULL DEFAULT '',
    bank_details TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_settings ADD COLUMN IF NOT EXISTS down_payment_percent NUMERIC NOT NULL DEFAULT 50;
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

-- ============================================================ 2. pinned addresses
ALTER TABLE public.customer_addresses ADD COLUMN IF NOT EXISTS lat NUMERIC, ADD COLUMN IF NOT EXISTS lng NUMERIC;

-- ============================================================ 3. orders: pick-up / delivery and payment
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_type TEXT NOT NULL DEFAULT 'delivery',
    ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC,
    ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC,
    ADD COLUMN IF NOT EXISTS delivery_km NUMERIC,
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS down_payment NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS down_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- orders placed before this migration: their work already started, so their down payment counts as received
UPDATE public.orders SET payment_status = 'down_paid', down_paid_at = COALESCE(down_paid_at, now())
 WHERE payment_status = 'unpaid' AND extended_status IS DISTINCT FROM 'pending' AND created_at < now() - interval '1 minute';
UPDATE public.orders o SET down_payment = round(COALESCE(o.amount, 0) * s.down_payment_percent / 100)
  FROM public.shop_settings s WHERE s.id = 1 AND o.down_payment = 0;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_pickup_type;
ALTER TABLE public.orders ADD CONSTRAINT orders_pickup_type CHECK (pickup_type IN ('delivery', 'pickup'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method
    CHECK (payment_method IS NULL OR payment_method IN ('cod', 'store', 'online'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cod_needs_delivery;
ALTER TABLE public.orders ADD CONSTRAINT orders_cod_needs_delivery CHECK (payment_method IS DISTINCT FROM 'cod' OR pickup_type = 'delivery');
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status CHECK (payment_status IN ('unpaid', 'down_paid', 'paid'));

-- fee and down payment are worked out here; only an admin changes the payment status
CREATE OR REPLACE FUNCTION public.order_delivery_and_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    s public.shop_settings;
BEGIN
    SELECT * INTO s FROM public.shop_settings WHERE id = 1;
    IF TG_OP = 'INSERT' OR NEW.pickup_type IS DISTINCT FROM OLD.pickup_type OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat OR NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng THEN
        IF NEW.pickup_type = 'pickup' THEN
            NEW.delivery_km := NULL;
            NEW.delivery_fee := 0;
            NEW.delivery_address := COALESCE(s.pickup_address, '');
            NEW.delivery_city := 'Pick-up at the store';
        ELSIF NEW.delivery_lat IS NOT NULL AND NEW.delivery_lng IS NOT NULL THEN
            NEW.delivery_km := public.km_between(s.shop_lat, s.shop_lng, NEW.delivery_lat, NEW.delivery_lng);
            NEW.delivery_fee := public.delivery_fee_for(NEW.delivery_km);
        ELSIF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Pin your delivery address on the map (Profile, Delivery addresses) before ordering for delivery';
        END IF;
        NEW.down_payment := round((COALESCE(NEW.amount, 0) + NEW.delivery_fee) * COALESCE(s.down_payment_percent, 50) / 100);
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NOT public.is_admin() THEN NEW.payment_status := 'unpaid'; NEW.down_paid_at := NULL; NEW.paid_at := NULL; END IF;
    ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only the shop can mark a payment as received';
        END IF;
        NEW.down_paid_at := CASE WHEN NEW.payment_status IN ('down_paid', 'paid') THEN COALESCE(NEW.down_paid_at, now()) END;
        NEW.paid_at := CASE WHEN NEW.payment_status = 'paid' THEN COALESCE(NEW.paid_at, now()) END;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_order_delivery_and_payment ON public.orders;
CREATE TRIGGER trg_order_delivery_and_payment BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.order_delivery_and_payment();

-- the customer sends the reference number of an online down payment (customers cannot update orders directly)
CREATE OR REPLACE FUNCTION public.submit_payment_reference(p_order UUID, p_reference TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    o public.orders;
    ref TEXT := left(trim(COALESCE(p_reference, '')), 40);
BEGIN
    SELECT * INTO o FROM public.orders WHERE id = p_order;
    IF NOT FOUND OR o.customer_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'This order is not yours.'; END IF;
    IF COALESCE((auth.jwt() -> 'app_metadata' ->> 'viewer') = 'true', false) THEN
        RAISE EXCEPTION 'This is a view-only account: changes are not saved.';
    END IF;
    IF o.payment_status = 'paid' THEN RAISE EXCEPTION 'This order is already fully paid.'; END IF;
    IF length(ref) < 4 THEN RAISE EXCEPTION 'Enter the reference number from your GCash or bank receipt.'; END IF;
    UPDATE public.orders SET payment_reference = ref WHERE id = p_order;
    INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
    SELECT p.id, 'Payment reference sent',
           format('%s sent payment reference %s for order %s. Check it and mark the payment as received.', COALESCE(o.customer_name, 'A customer'), ref, o.order_ref),
           'info', 'orders', o.id
      FROM public.user_profiles p WHERE p.role = 'admin' AND p.is_active;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_payment_reference(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_reference(UUID, TEXT) TO authenticated;

-- the customer is told (bell and email, migration 032) when the shop marks a payment received
CREATE OR REPLACE FUNCTION public.notify_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.customer_id IS NULL OR NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN RETURN NEW; END IF;
    IF NEW.payment_status = 'down_paid' THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (NEW.customer_id, 'Down payment received',
                format('We received your down payment of ₱%s for order %s (%s). We will now start making your furniture.',
                       to_char(NEW.down_payment, 'FM999,999,990'), NEW.order_ref, COALESCE(NEW.product_name, 'your furniture')),
                'success', 'orders', NEW.id);
    ELSIF NEW.payment_status = 'paid' THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (NEW.customer_id, 'Fully paid',
                format('Order %s (%s) is fully paid. Thank you!', NEW.order_ref, COALESCE(NEW.product_name, 'your furniture')),
                'success', 'orders', NEW.id);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_payment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_payment ON public.orders;
CREATE TRIGGER trg_notify_payment AFTER UPDATE OF payment_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_payment();

-- ============================================================ 4. no work before the down payment
CREATE OR REPLACE FUNCTION public.down_payment_gate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF OLD.extended_status = 'pending' AND NEW.extended_status = 'confirmed' AND NEW.payment_status = 'unpaid' THEN
        RAISE EXCEPTION 'Mark the down payment (₱%) as received before confirming this order', to_char(NEW.down_payment, 'FM999,999,990');
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_down_payment_gate ON public.orders;
CREATE TRIGGER trg_down_payment_gate BEFORE UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.down_payment_gate();

-- ============================================================ 5. name in parts, and the phone from sign-up
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS middle_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    m JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    parts TEXT := trim(concat_ws(' ', NULLIF(trim(m->>'first_name'), ''), NULLIF(trim(m->>'middle_name'), ''), NULLIF(trim(m->>'last_name'), '')));
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, first_name, middle_name, last_name, phone, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(parts, ''), NULLIF(m->>'full_name', ''), split_part(NEW.email, '@', 1)),
        COALESCE(trim(m->>'first_name'), ''),
        COALESCE(trim(m->>'middle_name'), ''),
        COALESCE(trim(m->>'last_name'), ''),
        COALESCE(m->>'phone', ''),
        (CASE WHEN m->>'role' = 'staff' THEN 'staff' ELSE 'customer' END)::public.user_role,
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
