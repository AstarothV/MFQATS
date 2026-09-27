-- Finite State Machine for order production stages (paper: "FSM — stage transitions").
-- orders.extended_status may only move along the edges in order_status_transitions. The database enforces it,
-- so no page or direct API call can skip a stage. The admin Orders page reads the same table to decide which
-- buttons are enabled, so this table is the single source of truth.

CREATE TABLE IF NOT EXISTS public.order_status_transitions (
    from_status public.extended_order_status NOT NULL,
    to_status public.extended_order_status NOT NULL,
    -- quality gate: the latest Quality Scan of this order at stage 'quality_check' must be 'pass'
    requires_qa_pass BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (from_status, to_status)
);

INSERT INTO public.order_status_transitions (from_status, to_status, requires_qa_pass) VALUES
    -- forward, one stage at a time
    ('pending', 'confirmed', false),
    ('confirmed', 'designing', false),
    ('designing', 'material_preparation', false),
    ('material_preparation', 'cutting', false),
    ('cutting', 'assembly', false),
    ('assembly', 'sanding', false),
    ('sanding', 'finishing', false),
    ('finishing', 'quality_inspection', false),
    ('quality_inspection', 'ready_for_delivery', true),
    ('ready_for_delivery', 'delivered', false),
    -- rework: a failed inspection sends the piece back to a production stage
    ('quality_inspection', 'cutting', false),
    ('quality_inspection', 'assembly', false),
    ('quality_inspection', 'sanding', false),
    ('quality_inspection', 'finishing', false),
    -- cancel from any stage before delivery
    ('pending', 'cancelled', false),
    ('confirmed', 'cancelled', false),
    ('designing', 'cancelled', false),
    ('material_preparation', 'cancelled', false),
    ('cutting', 'cancelled', false),
    ('assembly', 'cancelled', false),
    ('sanding', 'cancelled', false),
    ('finishing', 'cancelled', false),
    ('quality_inspection', 'cancelled', false),
    ('ready_for_delivery', 'cancelled', false)
ON CONFLICT DO NOTHING;
-- 'delivered' and 'cancelled' have no outgoing edges: they are final states.

ALTER TABLE public.order_status_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_status_transitions_read" ON public.order_status_transitions;
CREATE POLICY "order_status_transitions_read" ON public.order_status_transitions
FOR SELECT TO authenticated USING (true);
-- newer Supabase projects don't expose new tables to the website automatically
GRANT SELECT ON public.order_status_transitions TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_order_fsm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    gate BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.extended_status IS DISTINCT FROM 'pending' THEN
            RAISE EXCEPTION 'New orders must start at "pending" (got "%")', NEW.extended_status;
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.extended_status IS NOT DISTINCT FROM OLD.extended_status THEN
        RETURN NEW;  -- other columns changed; no stage move
    END IF;

    SELECT requires_qa_pass INTO gate
    FROM public.order_status_transitions
    WHERE from_status = COALESCE(OLD.extended_status, 'pending') AND to_status = NEW.extended_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid stage move: "%" -> "%"', COALESCE(OLD.extended_status, 'pending'), NEW.extended_status;
    END IF;

    IF gate AND (
        SELECT overall_result FROM public.detection_logs
        WHERE order_id = NEW.id AND stage_name = 'quality_check'
        ORDER BY created_at DESC LIMIT 1
    ) IS DISTINCT FROM 'pass' THEN
        RAISE EXCEPTION 'Quality gate: the latest Quality Scan (stage "Quality Check") for this order must pass first';
    END IF;

    RETURN NEW;
END;
$$;

-- Existing orders keep whatever status they have; the rules apply from their next move.
UPDATE public.orders SET extended_status = 'pending' WHERE extended_status IS NULL;

DROP TRIGGER IF EXISTS enforce_order_fsm ON public.orders;
CREATE TRIGGER enforce_order_fsm
    BEFORE INSERT OR UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_order_fsm();
