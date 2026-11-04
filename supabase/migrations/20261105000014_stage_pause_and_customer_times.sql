-- 1. Pausing the stage timer (Workshop): orders.paused_at is set while paused, and orders.paused_seconds adds up the
--    pauses in the current stage. Both reset by themselves when the order moves to another stage.
-- 2. Customers can read the stage history of their own orders, so OrderView/Overview can show when each stage finished.
-- Safe to run again.

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paused_seconds INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.reset_stage_pause()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.extended_status IS DISTINCT FROM OLD.extended_status THEN
        NEW.paused_at := NULL;
        NEW.paused_seconds := 0;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_stage_pause ON public.orders;
CREATE TRIGGER trg_reset_stage_pause
    BEFORE UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.reset_stage_pause();

DROP POLICY IF EXISTS "order_stage_history_customer_read" ON public.order_stage_history;
CREATE POLICY "order_stage_history_customer_read" ON public.order_stage_history
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_stage_history.order_id AND o.customer_id = auth.uid()));
