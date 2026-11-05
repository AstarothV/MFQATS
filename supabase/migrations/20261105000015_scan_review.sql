-- Admin review of a failed scan (a possible false alarm).
--   Staff: on a saved FAILED scan, ask an admin to review it (review_status = 'requested'); the admins are notified.
--   Admin: approve it as a false alarm ('approved') or confirm the defects ('rejected'); the staff member is notified.
--          Approving closes the order's open rework task.
--   Delivery: allowed when the latest scan passed, or when an admin approved it as a false alarm.
-- The scan's own result and detections never change: the record of what YOLOv12 found stays as it was.
-- Also: rewords old saved alerts and rework reasons that still say "AI quality scan" (new ones already don't).
-- Safe to run again.

ALTER TABLE public.detection_logs
    ADD COLUMN IF NOT EXISTS review_status TEXT CHECK (review_status IN ('requested', 'approved', 'rejected')),
    ADD COLUMN IF NOT EXISTS review_requested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE OR REPLACE FUNCTION public.guard_scan_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ref TEXT;
BEGIN
    IF NEW.overall_result IS DISTINCT FROM OLD.overall_result OR NEW.detections IS DISTINCT FROM OLD.detections THEN
        RAISE EXCEPTION 'A saved scan cannot be changed. Run and save a new scan instead.';
    END IF;
    IF NEW.review_status IS NOT DISTINCT FROM OLD.review_status THEN
        RETURN NEW;
    END IF;
    SELECT order_ref INTO ref FROM public.orders WHERE id = NEW.order_id;

    IF NEW.review_status = 'requested' THEN
        IF OLD.overall_result IS DISTINCT FROM 'fail' OR OLD.review_status IS NOT NULL OR NEW.order_id IS NULL THEN
            RAISE EXCEPTION 'Only a failed scan of an order can be sent for review, once';
        END IF;
        NEW.review_requested_by := auth.uid();
        NEW.review_requested_at := now();
        NEW.reviewed_by := NULL;
        NEW.reviewed_at := NULL;
        PERFORM public.notify_admins(
            'Scan review requested',
            format('Order %s: the staff think the failed scan may be a false alarm. Please review it in the Rework Queue.', ref),
            'warning', NEW.order_id);

    ELSIF NEW.review_status IN ('approved', 'rejected') THEN
        IF NOT public.is_admin() OR OLD.review_status IS DISTINCT FROM 'requested' THEN
            RAISE EXCEPTION 'Only an admin can decide a requested review';
        END IF;
        NEW.reviewed_by := auth.uid();
        NEW.reviewed_at := now();
        IF NEW.review_status = 'approved' THEN
            UPDATE public.rework_logs
            SET rework_status = 'rejected', resolved_by = auth.uid(), resolved_at = now(),
                notes = trim(both E'\n' FROM COALESCE(notes, '') || E'\nFalse alarm: the admin approved the scan after review.')
            WHERE order_id = NEW.order_id AND rework_status IN ('pending', 'in_progress');
        END IF;
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        SELECT u, CASE NEW.review_status WHEN 'approved' THEN 'Scan approved' ELSE 'Defects confirmed' END,
               CASE NEW.review_status
                   WHEN 'approved' THEN format('Order %s: the admin approved the scan as a false alarm. You can finish the order.', ref)
                   ELSE format('Order %s: the admin confirmed the defects. Send it back for rework.', ref) END
               || COALESCE(' Note: ' || NULLIF(NEW.review_note, ''), ''),
               (CASE NEW.review_status WHEN 'approved' THEN 'success' ELSE 'warning' END)::public.notification_type,
               'orders', NEW.order_id
        FROM (SELECT DISTINCT unnest(ARRAY[NEW.review_requested_by, NEW.inspector_id]) AS u) who
        WHERE u IS NOT NULL;

    ELSE
        RAISE EXCEPTION 'Invalid review change';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_scan_review ON public.detection_logs;
CREATE TRIGGER trg_guard_scan_review
    BEFORE UPDATE ON public.detection_logs
    FOR EACH ROW EXECUTE FUNCTION public.guard_scan_review();

-- Delivery gate: the latest scan passed, or an admin approved it as a false alarm.
CREATE OR REPLACE FUNCTION public.enforce_order_fsm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rule_gate TEXT;
    stage_since TIMESTAMPTZ;
    latest RECORD;
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
        SELECT overall_result, review_status INTO latest FROM public.detection_logs
        WHERE order_id = NEW.id ORDER BY created_at DESC LIMIT 1;
        IF NOT FOUND OR (latest.overall_result IS DISTINCT FROM 'pass' AND latest.review_status IS DISTINCT FROM 'approved') THEN
            RAISE EXCEPTION 'The latest defect scan of this order did not pass. After corrective action, send it back to Upload for re-inspection (or ask an admin to review a false alarm)';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Old alerts and rework reasons saved before migration 006 still say "AI quality scan"; reword them.
UPDATE public.rework_logs SET reason = replace(reason, 'AI quality scan', 'Defect detection') WHERE reason LIKE 'AI quality scan%';
UPDATE public.notifications
SET message = replace(replace(message, 'the AI quality scan', 'the quality scan'), 'the AI quality check', 'the quality check')
WHERE message LIKE '%AI quality%';

NOTIFY pgrst, 'reload schema';
