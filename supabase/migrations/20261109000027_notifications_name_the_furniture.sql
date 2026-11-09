-- Every notification about an order says what the furniture is (and, for a set of chairs, which chair):
--   "Order ORD-123456 (Ash Dining Chair, Chair 2 of 4) has defects (crack)..." instead of "Order ORD-123456 has defects..."
-- Covers: defect detection passed / defects found, the customer's "is now: <stage>", scan review requested /
-- approved / confirmed, new order messages, and inside parts checked. (Staff assignment and customer cancel already
-- named the furniture.) The wording is otherwise the same as before.
-- Run after migration 026 (it uses detection_logs.piece and orders.pieces). Safe to run more than once.

-- "Ash Dining Chair, Chair 2 of 4" for one piece of a set; "Ash Dining Chair × 4" for a whole set; else the product name
CREATE OR REPLACE FUNCTION public.order_furniture(p_order UUID, p_piece TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(o.product_name, 'furniture')
           || CASE WHEN p_piece IS NOT NULL AND p_piece <> '' THEN ', ' || p_piece
                   WHEN cardinality(o.pieces) > 1 AND o.product_name NOT LIKE '% more' THEN ' × ' || cardinality(o.pieces)
                   ELSE '' END
      FROM public.orders o WHERE o.id = p_order
$$;

-- ---------- defect detection passed / defects found (from migration 006) ----------
CREATE OR REPLACE FUNCTION public.after_quality_scan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ref TEXT;
    what TEXT;
    defect_names TEXT;
    fixes TEXT;
BEGIN
    IF NEW.order_id IS NULL THEN
        RETURN NEW;  -- practice scan, not tied to an order
    END IF;
    SELECT order_ref INTO ref FROM public.orders WHERE id = NEW.order_id;
    what := public.order_furniture(NEW.order_id, NEW.piece);

    IF NEW.overall_result = 'pass' THEN
        PERFORM public.notify_admins(
            'Defect detection passed',
            format('Order %s (%s) passed defect detection. Its Results are ready for review.', ref, what),
            'success', NEW.order_id);

    ELSIF NEW.overall_result = 'fail' THEN
        -- low-severity findings (live knots, resin...) are natural wood features, not reasons for rework
        SELECT string_agg(DISTINCT replace(d->>'class_name', '_', ' '), ', '),
               string_agg(DISTINCT format('%s: %s', replace(d->>'class_name', '_', ' '), d->>'recommendation'), E'\n')
        INTO defect_names, fixes
        FROM jsonb_array_elements(COALESCE(NEW.detections, '[]'::jsonb)) d
        WHERE d->>'severity' IS DISTINCT FROM 'low';

        INSERT INTO public.rework_logs (order_id, stage_name, reason, notes, created_by)
        VALUES (NEW.order_id, NEW.stage_name,
                format('Defect detection failed%s: %s', COALESCE(' on ' || NEW.piece, ''), COALESCE(defect_names, 'defects found')),
                COALESCE(fixes, ''), NEW.inspector_id);

        PERFORM public.notify_admins(
            'Defects detected — corrective action recommended',
            format('Order %s (%s) has defects (%s). A rework task with the recommended fixes was created.', ref, what, COALESCE(defect_names, 'defects found')),
            'warning', NEW.order_id);
    END IF;
    RETURN NEW;
END;
$$;

-- ---------- the customer's "Your order ... is now: <stage>" (from migration 006) ----------
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
                format('Your order %s (%s) is now: %s', NEW.order_ref, public.order_furniture(NEW.id), public.order_status_label(NEW.extended_status)),
                'info', 'orders', NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- ---------- scan review requested / approved / confirmed (from migration 015) ----------
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
    SELECT format('%s (%s)', order_ref, public.order_furniture(NEW.order_id, NEW.piece)) INTO ref FROM public.orders WHERE id = NEW.order_id;

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

-- ---------- new messages about an order (from migration 017) ----------
CREATE OR REPLACE FUNCTION public.notify_order_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o RECORD;
    preview TEXT := left(NEW.content, 120);
    what TEXT;
BEGIN
    IF NEW.order_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT id, order_ref, customer_id, assigned_to INTO o FROM public.orders WHERE id = NEW.order_id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    what := format('%s (%s)', o.order_ref, public.order_furniture(o.id));
    IF NEW.sender_role = 'customer' THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        SELECT u.id, 'New message from the customer', format('Order %s: %s', what, preview), 'info', 'order', o.id
          FROM public.user_profiles u
         WHERE u.id <> NEW.sender_id AND u.is_active
           AND (u.role = 'admin' OR u.id = o.assigned_to);
    ELSIF o.customer_id IS NOT NULL AND o.customer_id <> NEW.sender_id THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (o.customer_id, 'New message about your order', format('Order %s: %s', what, preview), 'info', 'order', o.id);
    END IF;
    RETURN NEW;
END;
$$;

-- ---------- inside parts checked (from migration 023), now with the chair of a set ----------
CREATE OR REPLACE FUNCTION public.notify_inside_checked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o RECORD;
    n INT := COALESCE(cardinality(NEW.inside_parts), 0);
    parts TEXT;
    inside_defects TEXT;
    what TEXT;
BEGIN
    IF NEW.order_id IS NULL OR n = 0 THEN
        RETURN NEW; -- a practice scan, or a piece without inside parts
    END IF;
    SELECT order_ref, customer_id INTO o FROM public.orders WHERE id = NEW.order_id;
    what := public.order_furniture(NEW.order_id, NEW.piece);
    parts := array_to_string(NEW.inside_parts, ', ');

    SELECT string_agg(DISTINCT format('%s on %s', replace(d->>'class_name', '_', ' '), d->>'side'), ', ')
      INTO inside_defects
      FROM jsonb_array_elements(COALESCE(NEW.detections, '[]'::JSONB)) d
     WHERE d->>'side' = ANY (NEW.inside_parts) AND d->>'severity' IS DISTINCT FROM 'low';

    PERFORM public.notify_admins(
        'Inside parts checked',
        format('Order %s (%s): the scan also covered %s inside part%s: %s. %s',
               o.order_ref, what, n, CASE WHEN n = 1 THEN '' ELSE 's' END, parts,
               COALESCE('Defects inside: ' || inside_defects || '.', 'No failing defects inside.')),
        (CASE WHEN inside_defects IS NULL THEN 'info' ELSE 'warning' END)::public.notification_type,
        NEW.order_id);

    IF o.customer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (o.customer_id, 'Inside of your order checked',
                format('We checked the inside of your %s (order %s), not just the outside: %s. The photos are in your Photo Gallery.',
                       what, o.order_ref, parts),
                'info', 'orders', NEW.order_id);
    END IF;
    RETURN NEW;
END;
$$;
