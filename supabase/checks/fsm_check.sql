-- FSM self-test. Paste into Supabase > SQL Editor > Run.
-- It creates a throw-away test order, tries legal and illegal stage moves, then ROLLS EVERYTHING BACK.
-- The result appears as a red "error" box on purpose: that error is what undoes the test data.
-- Every line in the report should start with PASS.

DO $$
DECLARE
    oid UUID;
    report TEXT := '';
    s TEXT;
BEGIN
    INSERT INTO public.orders (order_ref) VALUES ('FSM-TEST-' || gen_random_uuid()) RETURNING id INTO oid;

    -- 1. skipping a stage must be blocked
    BEGIN
        UPDATE public.orders SET extended_status = 'cutting' WHERE id = oid;
        report := report || E'\nFAIL 1. pending -> cutting (skip) was allowed';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 1. skip blocked: ' || SQLERRM;
    END;

    -- 2. moving forward one stage at a time must work
    FOREACH s IN ARRAY ARRAY['confirmed','designing','material_preparation','cutting','assembly','sanding','finishing','quality_inspection'] LOOP
        UPDATE public.orders SET extended_status = s::public.extended_order_status WHERE id = oid;
    END LOOP;
    report := report || E'\nPASS 2. pending -> ... -> quality_inspection, one step at a time';

    -- 3. delivery without a passing Quality Check scan must be blocked
    BEGIN
        UPDATE public.orders SET extended_status = 'ready_for_delivery' WHERE id = oid;
        report := report || E'\nFAIL 3. ready_for_delivery allowed with no scan';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 3. no scan -> blocked: ' || SQLERRM;
    END;

    -- 4. a FAILED scan must also block it
    INSERT INTO public.detection_logs (order_id, stage_name, overall_result) VALUES (oid, 'quality_check', 'fail');
    BEGIN
        UPDATE public.orders SET extended_status = 'ready_for_delivery' WHERE id = oid;
        report := report || E'\nFAIL 4. ready_for_delivery allowed after a failed scan';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 4. failed scan -> blocked';
    END;

    -- 5. rework loop: back to sanding, then forward again
    UPDATE public.orders SET extended_status = 'sanding' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'finishing' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'quality_inspection' WHERE id = oid;
    report := report || E'\nPASS 5. rework quality_inspection -> sanding -> finishing -> quality_inspection';

    -- 6. after a PASSING scan, delivery is allowed
    INSERT INTO public.detection_logs (order_id, stage_name, overall_result) VALUES (oid, 'quality_check', 'pass');
    UPDATE public.orders SET extended_status = 'ready_for_delivery' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'delivered' WHERE id = oid;
    report := report || E'\nPASS 6. passing scan -> ready_for_delivery -> delivered';

    -- 7. delivered is a final state
    BEGIN
        UPDATE public.orders SET extended_status = 'cancelled' WHERE id = oid;
        report := report || E'\nFAIL 7. delivered order could be cancelled';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 7. delivered is final: ' || SQLERRM;
    END;

    RAISE EXCEPTION 'FSM TEST REPORT (all test data rolled back):%', report;
END $$;
