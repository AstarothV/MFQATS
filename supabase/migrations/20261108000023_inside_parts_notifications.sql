-- Inside parts (cabinets, shelf units, dressers): a saved scan records which inside parts it covered (Interior, Shelf 1,
-- Drawer 2...), and a clear notification goes out:
--   the customer: "We checked the inside of your <piece> (order ...), not just the outside: Interior, Shelf 1, Door back.
--                  The photos are in your Photo Gallery."
--   the admins:   which inside parts were scanned, and any failing defects found inside.
-- Only parts that were actually scanned are named. Scans without inside parts send nothing new.
-- Safe to run more than once.

ALTER TABLE public.detection_logs ADD COLUMN IF NOT EXISTS inside_parts TEXT[] NOT NULL DEFAULT '{}';

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
BEGIN
    IF NEW.order_id IS NULL OR n = 0 THEN
        RETURN NEW; -- a practice scan, or a piece without inside parts
    END IF;
    SELECT order_ref, product_name, customer_id INTO o FROM public.orders WHERE id = NEW.order_id;
    parts := array_to_string(NEW.inside_parts, ', ');

    -- failing defects found on the inside parts (low = natural wood features, which do not fail a piece)
    SELECT string_agg(DISTINCT format('%s on %s', replace(d->>'class_name', '_', ' '), d->>'side'), ', ')
      INTO inside_defects
      FROM jsonb_array_elements(COALESCE(NEW.detections, '[]'::JSONB)) d
     WHERE d->>'side' = ANY (NEW.inside_parts) AND d->>'severity' IS DISTINCT FROM 'low';

    PERFORM public.notify_admins(
        'Inside parts checked',
        format('Order %s (%s): the scan also covered %s inside part%s: %s. %s',
               o.order_ref, o.product_name, n, CASE WHEN n = 1 THEN '' ELSE 's' END, parts,
               COALESCE('Defects inside: ' || inside_defects || '.', 'No failing defects inside.')),
        (CASE WHEN inside_defects IS NULL THEN 'info' ELSE 'warning' END)::public.notification_type,
        NEW.order_id);

    IF o.customer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (o.customer_id, 'Inside of your order checked',
                format('We checked the inside of your %s (order %s), not just the outside: %s. The photos are in your Photo Gallery.',
                       o.product_name, o.order_ref, parts),
                'info', 'orders', NEW.order_id);
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_inside_checked() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_inside_checked ON public.detection_logs;
CREATE TRIGGER trg_notify_inside_checked
    AFTER INSERT ON public.detection_logs
    FOR EACH ROW EXECUTE FUNCTION public.notify_inside_checked();
