-- Made-to-order and ready-made (in stock) furniture, and orders taken at the store (panel revision, November 2026).
--  1. products.stock_type: 'made_to_order' (built after the order, takes its production days) or 'in_stock'
--     (already made; stock_qty pieces on hand).
--  2. orders.order_type: 'made_to_order', or 'in_stock' when every item is in stock (no production wait; still
--     inspected before pick-up or delivery). orders.order_source: 'online' (the customer's checkout) or 'walk_in'
--     (entered by the admin for a customer at the store; the customer may have no account).
--  3. Placing an order takes the in-stock pieces off the stock (refused when there are not enough); cancelling the
--     order puts them back. A product whose stock reaches 0 shows Out of Stock.
--  4. Accounts: a sign-up without an email (phone only) is refused, so every account has an email it confirmed.
-- Safe to run more than once.

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS stock_type TEXT NOT NULL DEFAULT 'made_to_order',
    ADD COLUMN IF NOT EXISTS stock_qty INT NOT NULL DEFAULT 0;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_stock_type;
ALTER TABLE public.products ADD CONSTRAINT products_stock_type CHECK (stock_type IN ('made_to_order', 'in_stock'));
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_stock_qty;
ALTER TABLE public.products ADD CONSTRAINT products_stock_qty CHECK (stock_qty >= 0);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'made_to_order',
    ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'online',
    ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_type CHECK (order_type IN ('made_to_order', 'in_stock'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_source;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_source CHECK (order_source IN ('online', 'walk_in'));

-- the items of an order as (product, quantity); an order saved before items existed counts as its one product
CREATE OR REPLACE FUNCTION public.order_item_rows(o public.orders)
RETURNS TABLE (product_id UUID, qty INT) LANGUAGE sql STABLE AS $$
    SELECT (i->>'product_id')::uuid, GREATEST(COALESCE((i->>'quantity')::int, 1), 1)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) i
     WHERE i->>'product_id' IS NOT NULL
    UNION ALL
    SELECT o.product_id, GREATEST(COALESCE(o.quantity, 1), 1)
     WHERE o.product_id IS NOT NULL AND (o.items IS NULL OR jsonb_typeof(o.items) <> 'array' OR jsonb_array_length(o.items) = 0)
$$;

-- new order: type from its products, in-stock pieces taken off the stock; walk-in orders only by the shop
CREATE OR REPLACE FUNCTION public.order_stock_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r RECORD;
    p public.products;
    all_stock BOOLEAN := true;
    any_item BOOLEAN := false;
BEGIN
    IF NEW.order_source = 'walk_in' AND NOT public.is_staff_or_admin() AND auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Only the shop can enter a walk-in order';
    END IF;
    FOR r IN SELECT product_id, sum(qty)::int AS qty FROM public.order_item_rows(NEW) GROUP BY product_id LOOP
        any_item := true;
        SELECT * INTO p FROM public.products WHERE id = r.product_id FOR UPDATE;
        IF NOT FOUND OR p.stock_type <> 'in_stock' THEN
            all_stock := false;
            CONTINUE;
        END IF;
        IF p.stock_qty < r.qty THEN
            RAISE EXCEPTION 'Only % of % in stock', p.stock_qty, p.name;
        END IF;
        UPDATE public.products
           SET stock_qty = stock_qty - r.qty,
               availability = CASE WHEN stock_qty - r.qty = 0 THEN 'out_of_stock'::public.product_availability ELSE availability END
         WHERE id = p.id;
    END LOOP;
    NEW.order_type := CASE WHEN any_item AND all_stock THEN 'in_stock' ELSE 'made_to_order' END;
    IF NEW.order_type = 'in_stock' THEN
        NEW.due_date := current_date + 3; -- already made: only the inspection and the hand-over are left
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_order_stock_on_insert ON public.orders;
CREATE TRIGGER trg_order_stock_on_insert BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.order_stock_on_insert();

-- a cancelled order puts its in-stock pieces back
CREATE OR REPLACE FUNCTION public.order_stock_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
    IF NEW.extended_status = 'cancelled' AND OLD.extended_status IS DISTINCT FROM 'cancelled' THEN
        FOR r IN SELECT product_id, sum(qty)::int AS qty FROM public.order_item_rows(NEW) GROUP BY product_id LOOP
            UPDATE public.products
               SET stock_qty = stock_qty + r.qty,
                   availability = CASE WHEN availability = 'out_of_stock' THEN 'available'::public.product_availability ELSE availability END
             WHERE id = r.product_id AND stock_type = 'in_stock';
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_order_stock_on_cancel ON public.orders;
CREATE TRIGGER trg_order_stock_on_cancel AFTER UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.order_stock_on_cancel();

REVOKE EXECUTE ON FUNCTION public.order_stock_on_insert(), public.order_stock_on_cancel() FROM PUBLIC, anon, authenticated;

-- ============================================================ 4. no phone-only accounts
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
    -- every account needs an email it confirmed: a sign-up with only a phone number is refused
    IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
        RAISE EXCEPTION 'An email address is required to create an account';
    END IF;
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
