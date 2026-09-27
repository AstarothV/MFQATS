-- Production Timeline Engine (paper: Path C — PERT + Weighted Moving Average).
--
-- 1. Automated time tracking: every FSM stage move is timestamped in order_stage_history (no manual start/stop).
-- 2. PERT per stage from that history:  Te = (O + 4M + P) / 6
--      O = shortest time the stage has taken, M = average time, P = longest time.
-- 3. WMA per stage over the most recent cycles:  WMA = Σ(Wi·Ti) / ΣWi, Wi = 1..n (newest = n),
--    showing whether production is currently running faster or slower than the PERT estimate.
-- 4. order_eta(order): Estimated Delivery Date = now + remaining Te of the current stage + Te of every later stage.
-- Times are calendar hours (nights and weekends included).

-- ---------- 1. automated stage time tracking ----------
CREATE TABLE IF NOT EXISTS public.order_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status public.extended_order_status NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,                 -- NULL = the order is in this stage right now
    changed_by UUID DEFAULT auth.uid()   -- who moved the order INTO this stage
);
CREATE INDEX IF NOT EXISTS idx_order_stage_history_order ON public.order_stage_history(order_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_stage_history_status ON public.order_stage_history(status, left_at DESC);

ALTER TABLE public.order_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_stage_history_staff_read" ON public.order_stage_history;
CREATE POLICY "order_stage_history_staff_read" ON public.order_stage_history
FOR SELECT TO authenticated USING (public.is_staff_or_admin());

CREATE OR REPLACE FUNCTION public.track_order_stage_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.extended_status IS NOT DISTINCT FROM OLD.extended_status THEN
            RETURN NEW;
        END IF;
        UPDATE public.order_stage_history SET left_at = now()
        WHERE order_id = NEW.id AND left_at IS NULL;
    END IF;
    INSERT INTO public.order_stage_history (order_id, status) VALUES (NEW.id, COALESCE(NEW.extended_status, 'pending'));
    RETURN NEW;
END;
$$;

-- AFTER trigger: runs only once enforce_order_fsm (BEFORE) has accepted the move.
DROP TRIGGER IF EXISTS track_order_stage_time ON public.orders;
CREATE TRIGGER track_order_stage_time
    AFTER INSERT OR UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.track_order_stage_time();

-- Existing orders: start their clock now (their real start time was never recorded).
INSERT INTO public.order_stage_history (order_id, status, changed_by)
SELECT o.id, COALESCE(o.extended_status, 'pending'), NULL FROM public.orders o
WHERE NOT EXISTS (SELECT 1 FROM public.order_stage_history h WHERE h.order_id = o.id);

-- ---------- 2. starting estimates (used until a stage has enough real history) ----------
-- Calibration knob: replace these with MVCA's real shop-floor estimates (hours) in Table Editor.
CREATE TABLE IF NOT EXISTS public.stage_time_defaults (
    status public.extended_order_status PRIMARY KEY,
    optimistic_hours NUMERIC NOT NULL,
    most_likely_hours NUMERIC NOT NULL,
    pessimistic_hours NUMERIC NOT NULL
);
INSERT INTO public.stage_time_defaults VALUES
    ('pending', 4, 24, 72),
    ('confirmed', 2, 8, 24),
    ('designing', 8, 24, 72),
    ('material_preparation', 8, 24, 72),
    ('cutting', 4, 8, 24),
    ('assembly', 8, 16, 40),
    ('sanding', 4, 8, 16),
    ('finishing', 8, 16, 48),
    ('quality_inspection', 1, 4, 24),
    ('ready_for_delivery', 8, 24, 72)
ON CONFLICT DO NOTHING;

ALTER TABLE public.stage_time_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stage_time_defaults_read" ON public.stage_time_defaults;
CREATE POLICY "stage_time_defaults_read" ON public.stage_time_defaults
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "stage_time_defaults_admin_write" ON public.stage_time_defaults;
CREATE POLICY "stage_time_defaults_admin_write" ON public.stage_time_defaults
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 3. PERT + WMA per stage ----------
-- Returns only per-stage averages (no order or customer data), so every signed-in user may call it.
CREATE OR REPLACE FUNCTION public.stage_timeline_stats(min_samples INT DEFAULT 3, wma_window INT DEFAULT 5)
RETURNS TABLE (
    status public.extended_order_status,
    samples INT,              -- finished cycles of this stage in the history
    source TEXT,              -- 'history' (real data) or 'default' (stage_time_defaults, too few samples)
    optimistic_hours NUMERIC,
    most_likely_hours NUMERIC,
    pessimistic_hours NUMERIC,
    expected_hours NUMERIC,   -- PERT Te
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
          AND h.left_at - h.entered_at >= INTERVAL '1 minute'  -- stages clicked through by mistake/for a demo are not real work
    ),
    hist AS (
        SELECT d.status, COUNT(*)::INT AS n, MIN(d.hours) AS o, AVG(d.hours) AS m, MAX(d.hours) AS p
        FROM done d GROUP BY d.status
    ),
    wma AS (
        -- weight = window + 1 - recency, so the newest cycle weighs the most
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

-- ---------- 4. Estimated Delivery Date ----------
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

    -- stages run in enum order (pending ... ready_for_delivery); the current one may be partly done
    SELECT SUM(CASE WHEN s.status = cur
                    THEN GREATEST(s.expected_hours - EXTRACT(EPOCH FROM (now() - COALESCE(since, now()))) / 3600.0, 0)
                    ELSE s.expected_hours END)
    INTO remaining_hours
    FROM public.stage_timeline_stats() s
    WHERE s.status >= cur AND s.status < 'delivered';

    RETURN now() + make_interval(secs => (COALESCE(remaining_hours, 0) * 3600)::DOUBLE PRECISION);
END;
$$;

-- ---------- 5. Completion % from PERT ----------
-- % = expected hours of the stages already finished / expected hours of the whole order (pending ... ready_for_delivery),
-- so long stages count for more than short ones. Replaces the old fixed per-stage percentages.
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
    WHERE s.status < 'delivered';
$$;

CREATE OR REPLACE FUNCTION public.set_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.extended_status IS DISTINCT FROM 'cancelled' THEN  -- a cancelled order keeps the % it reached
        NEW.completion_pct := public.order_completion_pct(COALESCE(NEW.extended_status, 'pending'));
    END IF;
    RETURN NEW;
END;
$$;

-- BEFORE triggers run in name order: enforce_order_fsm validates the move first, then this sets the %.
DROP TRIGGER IF EXISTS set_order_completion ON public.orders;
CREATE TRIGGER set_order_completion
    BEFORE INSERT OR UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_order_completion();

-- existing orders: recalculate once
UPDATE public.orders SET completion_pct = public.order_completion_pct(COALESCE(extended_status, 'pending'))
WHERE extended_status IS DISTINCT FROM 'cancelled';

-- newer Supabase projects don't expose new tables to the website automatically; RLS above still limits rows
GRANT SELECT ON public.order_stage_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_time_defaults TO authenticated;

-- signed-in users only (Supabase grants functions to anon by default)
REVOKE EXECUTE ON FUNCTION public.stage_timeline_stats(INT, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.order_eta(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage_timeline_stats(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.order_eta(UUID) TO authenticated;
