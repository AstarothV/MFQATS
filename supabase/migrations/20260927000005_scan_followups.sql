-- What happens after a YOLO Quality Scan is saved, and customer stage notifications.
--   pass at stage 'quality_check' -> every admin is notified the order can be released
--   fail                          -> a rework task is created (defects + recommendations) and admins are notified
--   any FSM stage move            -> the order's customer is notified
-- Done in the database (SECURITY DEFINER) because the notifications policy only lets a user write their OWN
-- notifications, so a staff/admin page could never notify someone else.

-- shop orders have no product_items rows, so rework tasks must work at order level too
ALTER TABLE public.rework_logs ALTER COLUMN product_item_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_admins(p_title TEXT, p_message TEXT,
                                                p_type public.notification_type, p_order_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
    SELECT u.id, p_title, p_message, p_type, 'orders', p_order_id
    FROM public.user_profiles u WHERE u.role = 'admin';
$$;
REVOKE EXECUTE ON FUNCTION public.notify_admins(TEXT, TEXT, public.notification_type, UUID) FROM PUBLIC, anon, authenticated;

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

    IF NEW.overall_result = 'pass' AND NEW.stage_name = 'quality_check' THEN
        PERFORM public.notify_admins(
            'Quality Check passed',
            format('Order %s passed the AI quality check and can be moved to Ready for Delivery.', ref),
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
                format('AI quality scan failed: %s', COALESCE(defect_names, 'defects found')),
                COALESCE(fixes, ''), NEW.inspector_id);

        PERFORM public.notify_admins(
            'Quality scan failed — rework needed',
            format('Order %s failed the AI quality scan (%s). A rework task was created.', ref, COALESCE(defect_names, 'defects found')),
            'warning', NEW.order_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_quality_scan ON public.detection_logs;
CREATE TRIGGER after_quality_scan
    AFTER INSERT ON public.detection_logs
    FOR EACH ROW EXECUTE FUNCTION public.after_quality_scan();

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
                format('Your order %s is now: %s', NEW.order_ref, initcap(replace(NEW.extended_status::TEXT, '_', ' '))),
                'info', 'orders', NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_customer_stage ON public.orders;
CREATE TRIGGER notify_customer_stage
    AFTER UPDATE OF extended_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_customer_stage();
