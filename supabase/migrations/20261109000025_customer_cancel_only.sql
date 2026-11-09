-- Customers and their orders:
-- 1) A customer may cancel their own order while it is still Pending, and change nothing else. Before this, the
--    database let a customer update any column of their own order (for example approve it, or change its price).
--    Staff and admins are not affected; database functions (SECURITY DEFINER) are not affected either.
-- 2) When a customer cancels, the admins are notified.
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public.customer_order_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    fixed TEXT[] := ARRAY['extended_status', 'status', 'updated_at'];
BEGIN
    -- only a signed-in customer changing the row directly (not staff/admin, not the SQL Editor, not a DB function)
    IF current_user <> 'authenticated' OR auth.uid() IS NULL OR public.is_staff_or_admin() THEN
        RETURN NEW;
    END IF;
    IF OLD.extended_status IS DISTINCT FROM 'pending' OR NEW.extended_status IS DISTINCT FROM 'cancelled'
       OR (to_jsonb(NEW) - fixed) IS DISTINCT FROM (to_jsonb(OLD) - fixed) THEN
        RAISE EXCEPTION 'You can only cancel an order while it is still Pending';
    END IF;
    RETURN NEW;
END;
$$;

-- BEFORE triggers run in name order: this one first, so it sees exactly what the customer sent
DROP TRIGGER IF EXISTS a_customer_order_guard ON public.orders;
CREATE TRIGGER a_customer_order_guard
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.customer_order_guard();

CREATE OR REPLACE FUNCTION public.notify_customer_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.extended_status = 'cancelled' AND OLD.extended_status IS DISTINCT FROM 'cancelled'
       AND auth.uid() IS NOT NULL AND auth.uid() = NEW.customer_id THEN
        PERFORM public.notify_admins(
            'Order cancelled by the customer',
            format('%s cancelled order %s (%s) before it was approved.', COALESCE(NEW.customer_name, 'The customer'), NEW.order_ref, NEW.product_name),
            'warning', NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_customer_cancel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_customer_cancel ON public.orders;
CREATE TRIGGER trg_notify_customer_cancel
    AFTER UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_customer_cancel();
