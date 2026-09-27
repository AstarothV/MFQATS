-- PERT + WMA self-test. Paste into Supabase > SQL Editor > Run.
-- Inside one transaction it sets aside the real stage history, adds three known sanding cycles (4h, 6h, 8h),
-- checks the math, then ROLLS EVERYTHING BACK: the red "error" box is on purpose and nothing is changed.
-- Every line in the report should start with PASS.

DO $$
DECLARE
    oid UUID;
    s RECORD;
    hours_left NUMERIC;
    report TEXT := '';
BEGIN
    DELETE FROM public.order_stage_history;  -- undone by the rollback at the end

    -- 1. automated time tracking
    INSERT INTO public.orders (order_ref) VALUES ('PERT-TEST-' || gen_random_uuid()) RETURNING id INTO oid;
    UPDATE public.orders SET extended_status = 'confirmed' WHERE id = oid;
    IF (SELECT COUNT(*) FROM public.order_stage_history WHERE order_id = oid AND left_at IS NOT NULL) = 1
       AND (SELECT status FROM public.order_stage_history WHERE order_id = oid AND left_at IS NULL) = 'confirmed' THEN
        report := report || E'\nPASS 1. stage move timestamped automatically (pending closed, confirmed open)';
    ELSE
        report := report || E'\nFAIL 1. stage move was not timestamped';
    END IF;

    -- 2. PERT + WMA on three sanding cycles: 4h (oldest), 6h, 8h (newest)
    INSERT INTO public.order_stage_history (order_id, status, entered_at, left_at) VALUES
        (oid, 'sanding', now() - interval '3 days' - interval '4 hours', now() - interval '3 days'),
        (oid, 'sanding', now() - interval '2 days' - interval '6 hours', now() - interval '2 days'),
        (oid, 'sanding', now() - interval '1 day'  - interval '8 hours', now() - interval '1 day');
    SELECT * INTO s FROM public.stage_timeline_stats() WHERE status = 'sanding';
    report := report || format(E'\n%s 2. O=%s M=%s P=%s (expected 4, 6, 8)',
        CASE WHEN (s.optimistic_hours, s.most_likely_hours, s.pessimistic_hours) = (4, 6, 8) THEN 'PASS' ELSE 'FAIL' END,
        s.optimistic_hours, s.most_likely_hours, s.pessimistic_hours);
    report := report || format(E'\n%s 3. PERT Te = (4 + 4x6 + 8) / 6 = %s (expected 6)',
        CASE WHEN s.expected_hours = 6 THEN 'PASS' ELSE 'FAIL' END, s.expected_hours);
    report := report || format(E'\n%s 4. WMA = (5x8 + 4x6 + 3x4) / 12 = %s (expected 6.33, newest cycle weighs most)',
        CASE WHEN s.wma_hours = 6.33 THEN 'PASS' ELSE 'FAIL' END, s.wma_hours);

    -- 3. Estimated Delivery Date for an order that just entered sanding:
    --    Te(sanding) + Te(finishing) + Te(quality_inspection) + Te(ready_for_delivery)
    UPDATE public.orders SET extended_status = 'designing' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'material_preparation' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'cutting' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'assembly' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'sanding' WHERE id = oid;
    hours_left := ROUND(EXTRACT(EPOCH FROM (public.order_eta(oid) - now())) / 3600.0, 2);
    report := report || format(E'\n%s 5. ETA = now + %s hours (expected %s = sum of Te of the remaining stages)',
        CASE WHEN hours_left = (SELECT SUM(expected_hours) FROM public.stage_timeline_stats()
                                WHERE status >= 'sanding' AND status < 'delivered') THEN 'PASS' ELSE 'FAIL' END,
        hours_left,
        (SELECT SUM(expected_hours) FROM public.stage_timeline_stats() WHERE status >= 'sanding' AND status < 'delivered'));

    RAISE EXCEPTION 'PERT/WMA TEST REPORT (all test data rolled back):%', report;
END $$;
