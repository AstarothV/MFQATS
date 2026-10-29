-- Who works on each order. Order Management, Team Management and the staff's own Assigned Tasks all read and write
-- this one column, so they always agree.
--   orders.assigned_to  the staff member working on the order (NULL = nobody yet)
--   orders.assigned_at  when that staff member was assigned (set automatically)
-- When an order is assigned, the staff member gets a notification. The orders table is also added to Supabase's live
-- updates, so the pages refresh by themselves when an order changes.
-- Safe to run again: every step checks first.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON public.orders(assigned_to);

CREATE OR REPLACE FUNCTION public.on_order_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
        NEW.assigned_at := CASE WHEN NEW.assigned_to IS NULL THEN NULL ELSE now() END;
        IF NEW.assigned_to IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
            VALUES (NEW.assigned_to, 'New order assigned to you',
                    format('You were assigned %s (%s). It is at: %s', NEW.order_ref, NEW.product_name,
                           initcap(replace(coalesce(NEW.extended_status::TEXT, 'pending'), '_', ' '))),
                    'info', 'orders', NEW.id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_assigned ON public.orders;
CREATE TRIGGER trg_order_assigned
    BEFORE UPDATE OF assigned_to ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.on_order_assigned();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;
