-- MFQATS official process: Upload -> 3D Reconstruction -> Detect Defects -> Results -> Recommendation
--
-- Replaces the old workshop stages (designing ... ready_for_delivery) as the order workflow. An order is
--   pending -> confirmed -> [ upload -> reconstruction_3d -> detect_defects -> results -> recommendation ] -> delivered
-- 'pending', 'confirmed', 'delivered' and 'cancelled' are order statuses (placed / approved / closed), not process
-- stages. The five names in brackets are the only process stages.
--
-- Rules enforced by the database (FSM):
--   * one step at a time, no skipping
--   * Detect Defects -> Results needs a defect scan saved for the order during the current Detect Defects stage
--   * Recommendation -> Delivered needs the latest scan to have passed
--   * Recommendation -> Upload sends the item back for re-inspection after corrective action
--   * any status before Delivered -> Cancelled
-- Safe to run more than once.

-- ---------- 1. swap the status type (runs once) ----------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'extended_order_status' AND t.typnamespace = 'public'::regnamespace AND e.enumlabel = 'upload'
    ) THEN
        -- everything that depends on the old type or on the orders.extended_status column
        DROP TRIGGER IF EXISTS enforce_order_fsm ON public.orders;
        DROP TRIGGER IF EXISTS set_order_completion ON public.orders;
        DROP TRIGGER IF EXISTS track_order_stage_time ON public.orders;
        DROP TRIGGER IF EXISTS notify_customer_stage ON public.orders;
        DROP FUNCTION IF EXISTS public.order_eta(UUID);
        DROP FUNCTION IF EXISTS public.order_completion_pct(public.extended_order_status);
        DROP FUNCTION IF EXISTS public.stage_timeline_stats(INT, INT);
        DROP TABLE IF EXISTS public.order_status_transitions;
        DROP TABLE IF EXISTS public.stage_time_defaults;

        ALTER TYPE public.extended_order_status RENAME TO extended_order_status_legacy;
        CREATE TYPE public.extended_order_status AS ENUM (
            'pending', 'confirmed',
            'upload', 'reconstruction_3d', 'detect_defects', 'results', 'recommendation',
            'delivered', 'cancelled'
        );

        -- Existing orders: the old workshop stages have no equivalent in the new process, so orders that were in
        -- production start the inspection process at Upload; the two old QA-side statuses land where their
        -- inspection work stands.
        ALTER TABLE public.orders ALTER COLUMN extended_status DROP DEFAULT;
        ALTER TABLE public.orders ALTER COLUMN extended_status TYPE public.extended_order_status USING (
            CASE extended_status::TEXT
                WHEN 'pending' THEN 'pending'
                WHEN 'confirmed' THEN 'confirmed'
                WHEN 'delivered' THEN 'delivered'
                WHEN 'cancelled' THEN 'cancelled'
                WHEN 'quality_inspection' THEN 'detect_defects'
                WHEN 'ready_for_delivery' THEN 'recommendation'
                ELSE 'upload'
            END)::public.extended_order_status;
        ALTER TABLE public.orders ALTER COLUMN extended_status SET DEFAULT 'pending';

        -- Stage history: finished cycles of the old workshop stages are timings of stages that no longer exist.
        DELETE FROM public.order_stage_history
        WHERE left_at IS NOT NULL AND status::TEXT NOT IN ('pending', 'confirmed', 'delivered', 'cancelled');
        ALTER TABLE public.order_stage_history ALTER COLUMN status TYPE public.extended_order_status USING (
            CASE status::TEXT
                WHEN 'pending' THEN 'pending'
                WHEN 'confirmed' THEN 'confirmed'
                WHEN 'delivered' THEN 'delivered'
                WHEN 'cancelled' THEN 'cancelled'
                WHEN 'quality_inspection' THEN 'detect_defects'
                WHEN 'ready_for_delivery' THEN 'recommendation'
                ELSE 'upload'
            END)::public.extended_order_status;

        BEGIN
            DROP TYPE public.extended_order_status_legacy;
        EXCEPTION WHEN dependent_objects_still_exist THEN
            NULL;  -- something outside these migrations still uses it; leaving the old type behind is harmless
        END;
    END IF;
END $$;

-- ---------- 2. official labels ----------
CREATE OR REPLACE FUNCTION public.order_status_label(p_status public.extended_order_status)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_status
        WHEN 'pending' THEN 'Pending'
        WHEN 'confirmed' THEN 'Confirmed'
        WHEN 'upload' THEN 'Upload'
        WHEN 'reconstruction_3d' THEN '3D Reconstruction'
        WHEN 'detect_defects' THEN 'Detect Defects'
        WHEN 'results' THEN 'Results'
        WHEN 'recommendation' THEN 'Recommendation'
        WHEN 'delivered' THEN 'Delivered'
        WHEN 'cancelled' THEN 'Cancelled'
    END;
$$;

-- ---------- 3. FSM ----------
CREATE TABLE IF NOT EXISTS public.order_status_transitions (
    from_status public.extended_order_status NOT NULL,
    to_status public.extended_order_status NOT NULL,
    -- NULL = no condition; 'scan_done' = a defect scan was saved during the current stage;
    -- 'scan_passed' = the latest defect scan of the order passed
    gate TEXT CHECK (gate IN ('scan_done', 'scan_passed')),
    PRIMARY KEY (from_status, to_status)
);

INSERT INTO public.order_status_transitions (from_status, to_status, gate) VALUES
    ('pending', 'confirmed', NULL),
    ('confirmed', 'upload', NULL),
    ('upload', 'reconstruction_3d', NULL),
    ('reconstruction_3d', 'detect_defects', NULL),
    ('detect_defects', 'results', 'scan_done'),
    ('results', 'recommendation', NULL),
    ('recommendation', 'delivered', 'scan_passed'),
    -- corrective action done: inspect the item again from the start
    ('recommendation', 'upload', NULL),
    ('pending', 'cancelled', NULL),
    ('confirmed', 'cancelled', NULL),
    ('upload', 'cancelled', NULL),
    ('reconstruction_3d', 'cancelled', NULL),
    ('detect_defects', 'cancelled', NULL),
    ('results', 'cancelled', NULL),
    ('recommendation', 'cancelled', NULL)
ON CONFLICT DO NOTHING;
-- 'delivered' and 'cancelled' have no outgoing edges: they are final.

ALTER TABLE public.order_status_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_status_transitions_read" ON public.order_status_transitions;
CREATE POLICY "order_status_transitions_read" ON public.order_status_transitions
FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.order_status_transitions TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_order_fsm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rule_gate TEXT;
    stage_since TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.extended_status IS DISTINCT FROM 'pending' THEN
            RAISE EXCEPTION 'New orders must start at "Pending" (got "%")', public.order_status_label(NEW.extended_status);
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.extended_status IS NOT DISTINCT FROM OLD.extended_status THEN
        RETURN NEW;  -- other columns changed; no stage move
    END IF;

    SELECT gate INTO rule_gate
    FROM public.order_status_transitions
    WHERE from_status = COALESCE(OLD.extended_status, 'pending') AND to_status = NEW.extended_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid stage move: "%" -> "%"',
            public.order_status_label(COALESCE(OLD.extended_status, 'pending')), public.order_status_label(NEW.extended_status);
    END IF;

    IF rule_gate = 'scan_done' THEN
        SELECT h.entered_at INTO stage_since FROM public.order_stage_history h
        WHERE h.order_id = NEW.id AND h.left_at IS NULL
        ORDER BY h.entered_at DESC LIMIT 1;
        IF NOT EXISTS (
            SELECT 1 FROM public.detection_logs d
            WHERE d.order_id = NEW.id AND d.created_at >= COALESCE(stage_since, '-infinity')
        ) THEN
            RAISE EXCEPTION 'Detect Defects is not finished: run and save a defect scan for this order first';
        END IF;
    ELSIF rule_gate = 'scan_passed' THEN
        IF (
            SELECT overall_result FROM public.detection_logs
            WHERE order_id = NEW.id ORDER BY created_at DESC LIMIT 1
        ) IS DISTINCT FROM 'pass' THEN
            RAISE EXCEPTION 'The latest defect scan of this order did not pass. After corrective action, send it back to Upload for re-inspection';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- ---------- 4. starting time estimates (hours) for PERT ----------
-- Calibration knob: replace with MVCA's real figures in Table Editor. 'confirmed' is the wait between approval
-- and the item being ready for inspection; 3D Reconstruction follows the paper's 20-30 minute estimate.
CREATE TABLE IF NOT EXISTS public.stage_time_defaults (
    status public.extended_order_status PRIMARY KEY,
    optimistic_hours NUMERIC NOT NULL,
    most_likely_hours NUMERIC NOT NULL,
    pessimistic_hours NUMERIC NOT NULL
);
INSERT INTO public.stage_time_defaults VALUES
    ('pending', 4, 24, 72),
    ('confirmed', 24, 72, 168),
    ('upload', 0.25, 0.5, 2),
    ('reconstruction_3d', 0.33, 0.5, 1),
    ('detect_defects', 0.1, 0.25, 1),
    ('results', 0.25, 1, 4),
    ('recommendation', 0.5, 2, 8)
ON CONFLICT DO NOTHING;

ALTER TABLE public.stage_time_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stage_time_defaults_read" ON public.stage_time_defaults;
CREATE POLICY "stage_time_defaults_read" ON public.stage_time_defaults
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "stage_time_defaults_admin_write" ON public.stage_time_defaults;
CREATE POLICY "stage_time_defaults_admin_write" ON public.stage_time_defaults
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_time_defaults TO authenticated;

-- ---------- 5. PERT + WMA per status (same math as before, new stages) ----------
CREATE OR REPLACE FUNCTION public.stage_timeline_stats(min_samples INT DEFAULT 3, wma_window INT DEFAULT 5)
RETURNS TABLE (
    status public.extended_order_status,
    samples INT,
    source TEXT,              -- 'history' (real data) or 'default' (stage_time_defaults, too few samples)
    optimistic_hours NUMERIC,
    most_likely_hours NUMERIC,
    pessimistic_hours NUMERIC,
    expected_hours NUMERIC,   -- PERT Te = (O + 4M + P) / 6
    wma_hours NUMERIC         -- WMA of the latest cycles; NULL until there is history
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH done AS (
        SELECT h.status,
               EXTRACT(EPOCH FROM (h.left_at - h.entered_at)) / 3600.0 AS hours,
               ROW_NUMBER() OVER (PARTITION BY h.status ORDER BY h.left_at DESC) AS recency  -- 1 = newest
        FROM public.order_stage_history h
        WHERE h.left_at IS NOT NULL
          AND h.left_at - h.entered_at >= INTERVAL '1 minute'  -- stages clicked through are not real work
    ),
    hist AS (
        SELECT d.status, COUNT(*)::INT AS n, MIN(d.hours) AS o, AVG(d.hours) AS m, MAX(d.hours) AS p
        FROM done d GROUP BY d.status
    ),
    wma AS (
        SELECT d.status, SUM((wma_window + 1 - d.recency) * d.hours) / SUM(wma_window + 1 - d.recency) AS w
        FROM done d WHERE d.recency <= wma_window GROUP BY d.status
    ),
    pick AS (
        SELECT s.status,
               COALESCE(h.n, 0) AS n,
               COALESCE(h.n, 0) >= min_samples AS use_hist,
               h.o, h.m, h.p, s.optimistic_hours AS d_o, s.most_likely_hours AS d_m, s.pessimistic_hours AS d_p
        FROM public.stage_time_defaults s LEFT JOIN hist h ON h.status = s.status
    )
    SELECT p.status, p.n,
           CASE WHEN p.use_hist THEN 'history' ELSE 'default' END,
           ROUND(CASE WHEN p.use_hist THEN p.o ELSE p.d_o END, 2),
           ROUND(CASE WHEN p.use_hist THEN p.m ELSE p.d_m END, 2),
           ROUND(CASE WHEN p.use_hist THEN p.p ELSE p.d_p END, 2),
           ROUND(CASE WHEN p.use_hist THEN (p.o + 4 * p.m + p.p) / 6 ELSE (p.d_o + 4 * p.d_m + p.d_p) / 6 END, 2),
           ROUND(w.w, 2)
    FROM pick p LEFT JOIN wma w ON w.status = p.status
    ORDER BY p.status;
$$;

-- Estimated completion = now + what is left of the current status + Te of every later one (enum order).
CREATE OR REPLACE FUNCTION public.order_eta(p_order_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cur public.extended_order_status;
    since TIMESTAMPTZ;
    remaining_hours NUMERIC;
BEGIN
    -- only the order's customer, staff and admins may see its estimate
    SELECT o.extended_status INTO cur FROM public.orders o
    WHERE o.id = p_order_id
      AND (o.customer_id = auth.uid() OR public.is_staff_or_admin() OR auth.uid() IS NULL);  -- NULL = SQL Editor (anon is revoked below)
    IF NOT FOUND OR cur IN ('delivered', 'cancelled') THEN
        RETURN NULL;
    END IF;

    SELECT h.entered_at INTO since FROM public.order_stage_history h
    WHERE h.order_id = p_order_id AND h.left_at IS NULL
    ORDER BY h.entered_at DESC LIMIT 1;

    SELECT SUM(CASE WHEN s.status = cur
                    THEN GREATEST(s.expected_hours - EXTRACT(EPOCH FROM (now() - COALESCE(since, now()))) / 3600.0, 0)
                    ELSE s.expected_hours END)
    INTO remaining_hours
    FROM public.stage_timeline_stats() s
    WHERE s.status >= cur AND s.status < 'delivered';

    RETURN now() + make_interval(secs => (COALESCE(remaining_hours, 0) * 3600)::DOUBLE PRECISION);
END;
$$;

-- Completion % = share of the five-stage process already finished, weighted by each stage's PERT time.
-- Pending/Confirmed = 0 % (the process has not started), Delivered = 100 %.
CREATE OR REPLACE FUNCTION public.order_completion_pct(p_status public.extended_order_status)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN p_status = 'delivered' THEN 100
                ELSE COALESCE(ROUND(100 * SUM(s.expected_hours) FILTER (WHERE s.status < p_status)
                                        / NULLIF(SUM(s.expected_hours), 0))::INT, 0)
           END
    FROM public.stage_timeline_stats() s
    WHERE s.status BETWEEN 'upload' AND 'recommendation';
$$;

REVOKE EXECUTE ON FUNCTION public.stage_timeline_stats(INT, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.order_eta(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage_timeline_stats(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.order_eta(UUID) TO authenticated;

-- ---------- 6. follow-ups that mention stages ----------
-- A saved defect scan is the Detect Defects step itself, so it no longer carries a workshop stage.
CREATE OR REPLACE FUNCTION public.after_quality_scan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ref TEXT;
    defect_names TEXT;
    fixes TEXT;
BEGIN
    IF NEW.order_id IS NULL THEN
        RETURN NEW;  -- practice scan, not tied to an order
    END IF;
    SELECT order_ref INTO ref FROM public.orders WHERE id = NEW.order_id;

    IF NEW.overall_result = 'pass' THEN
        PERFORM public.notify_admins(
            'Defect detection passed',
            format('Order %s passed defect detection. Its Results are ready for review.', ref),
            'success', NEW.order_id);

    ELSIF NEW.overall_result = 'fail' THEN
        -- low-severity findings (live knots, resin...) are natural wood features, not reasons for rework
        SELECT string_agg(DISTINCT d->>'class_name', ', '),
               string_agg(DISTINCT format('%s: %s', d->>'class_name', d->>'recommendation'), E'\n')
        INTO defect_names, fixes
        FROM jsonb_array_elements(COALESCE(NEW.detections, '[]'::jsonb)) d
        WHERE d->>'severity' IS DISTINCT FROM 'low';

        INSERT INTO public.rework_logs (order_id, stage_name, reason, notes, created_by)
        VALUES (NEW.order_id, NEW.stage_name,
                format('Defect detection failed: %s', COALESCE(defect_names, 'defects found')),
                COALESCE(fixes, ''), NEW.inspector_id);

        PERFORM public.notify_admins(
            'Defects detected — corrective action recommended',
            format('Order %s has defects (%s). A rework task with the recommended fixes was created.', ref, COALESCE(defect_names, 'defects found')),
            'warning', NEW.order_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_customer_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL AND NEW.extended_status IS DISTINCT FROM OLD.extended_status THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (NEW.customer_id, 'Order Status Updated',
                format('Your order %s is now: %s', NEW.order_ref, public.order_status_label(NEW.extended_status)),
                'info', 'orders', NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- ---------- 7. triggers (BEFORE triggers run in name order: enforce, then set %) ----------
DROP TRIGGER IF EXISTS enforce_order_fsm ON public.orders;
CREATE TRIGGER enforce_order_fsm
    BEFORE INSERT OR UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_order_fsm();

DROP TRIGGER IF EXISTS set_order_completion ON public.orders;
CREATE TRIGGER set_order_completion
    BEFORE INSERT OR UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_order_completion();

DROP TRIGGER IF EXISTS track_order_stage_time ON public.orders;
CREATE TRIGGER track_order_stage_time
    AFTER INSERT OR UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.track_order_stage_time();

DROP TRIGGER IF EXISTS notify_customer_stage ON public.orders;
CREATE TRIGGER notify_customer_stage
    AFTER UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_customer_stage();

-- every existing order: recalculate completion for the new process
UPDATE public.orders SET completion_pct = public.order_completion_pct(COALESCE(extended_status, 'pending'))
WHERE extended_status IS DISTINCT FROM 'cancelled';

-- make the website's API see the new tables and values straight away
NOTIFY pgrst, 'reload schema';
