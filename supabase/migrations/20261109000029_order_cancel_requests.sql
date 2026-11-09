-- Cancelling an order: the customer asks, the admin decides.
-- 1) The customer asks to cancel a Pending order and says why (request_order_cancel). The admins are notified with
--    the reason. The order shows "Cancellation requested" until an admin decides.
-- 2) An admin approves (approve_order_cancel: the order becomes Cancelled; the customer is told) or keeps the order
--    (decline_order_cancel: the request is cleared; the customer is told, with the admin's note).
-- 3) Customers no longer change orders directly at all (this replaces migration 025's "cancel only" rule): the two
--    functions above are the only way, and they check everything themselves.
-- Safe to run more than once. Works whether or not migrations 025 / 027 were run.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- ---------- 1. the customer asks ----------
CREATE OR REPLACE FUNCTION public.request_order_cancel(p_order UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o RECORD;
    why TEXT := left(trim(COALESCE(p_reason, '')), 500);
BEGIN
    SELECT * INTO o FROM public.orders WHERE id = p_order;
    IF NOT FOUND OR o.customer_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'This order is not yours.';
    END IF;
    IF COALESCE((auth.jwt() -> 'app_metadata' ->> 'viewer') = 'true', false) THEN
        RAISE EXCEPTION 'This is a view-only account: changes are not saved.';
    END IF;
    IF o.extended_status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'Only an order that is still Pending can be cancelled here. For this order, send the shop a message in Inquiry.';
    END IF;
    IF o.cancel_requested_at IS NOT NULL THEN
        RAISE EXCEPTION 'You already asked to cancel this order. The shop will reply soon.';
    END IF;
    IF length(why) < 3 THEN
        RAISE EXCEPTION 'Please tell us why you want to cancel.';
    END IF;

    UPDATE public.orders SET cancel_requested_at = now(), cancel_reason = why WHERE id = p_order;

    INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
    SELECT u.id, 'Cancellation requested',
           format('%s asked to cancel order %s (%s). Reason: %s', COALESCE(o.customer_name, 'The customer'), o.order_ref, o.product_name, left(why, 200)),
           'warning', 'orders', o.id
      FROM public.user_profiles u WHERE u.role = 'admin';
END;
$$;

-- ---------- 2. the admin decides ----------
CREATE OR REPLACE FUNCTION public.approve_order_cancel(p_order UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only an admin can approve a cancellation.';
    END IF;
    SELECT * INTO o FROM public.orders WHERE id = p_order;
    IF NOT FOUND OR o.cancel_requested_at IS NULL THEN
        RAISE EXCEPTION 'There is no cancellation request for this order.';
    END IF;
    IF o.extended_status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'This order is no longer Pending, so it cannot be cancelled from the request.';
    END IF;
    -- the usual stage rules and the customer's "is now: Cancelled" notification run as for any stage move
    UPDATE public.orders SET extended_status = 'cancelled', status = 'cancelled' WHERE id = p_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_order_cancel(p_order UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o RECORD;
    note TEXT := NULLIF(left(trim(COALESCE(p_note, '')), 300), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only an admin can decide a cancellation request.';
    END IF;
    SELECT * INTO o FROM public.orders WHERE id = p_order;
    IF NOT FOUND OR o.cancel_requested_at IS NULL THEN
        RAISE EXCEPTION 'There is no cancellation request for this order.';
    END IF;
    UPDATE public.orders SET cancel_requested_at = NULL, cancel_reason = NULL WHERE id = p_order;
    IF o.customer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (o.customer_id, 'Cancellation not approved',
                format('Your request to cancel order %s (%s) was not approved, so the order goes ahead.%s',
                       o.order_ref, o.product_name, COALESCE(' Note from the shop: ' || note, ' Message the shop in Inquiry if you have questions.')),
                'info', 'orders', o.id);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_order_cancel(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_order_cancel(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decline_order_cancel(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_order_cancel(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_order_cancel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_order_cancel(UUID, TEXT) TO authenticated;

-- ---------- 3. customers do not change orders directly ----------
CREATE OR REPLACE FUNCTION public.customer_order_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- only a signed-in customer changing the row directly (not staff/admin, not the SQL Editor, not a DB function)
    IF current_user <> 'authenticated' OR auth.uid() IS NULL OR public.is_staff_or_admin() THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'To cancel an order, use Cancel order: the shop approves it.';
END;
$$;

DROP TRIGGER IF EXISTS a_customer_order_guard ON public.orders;
CREATE TRIGGER a_customer_order_guard
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.customer_order_guard();

-- the request notifies the admins now (migration 025 notified them when a customer cancelled directly)
DROP TRIGGER IF EXISTS trg_notify_customer_cancel ON public.orders;

NOTIFY pgrst, 'reload schema';
