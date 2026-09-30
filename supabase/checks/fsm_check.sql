-- FSM self-test for the five-stage process. Paste into Supabase > SQL Editor > Run.
--   Upload -> 3D Reconstruction -> Detect Defects -> Results -> Recommendation
-- It creates a throw-away test order, tries legal and illegal moves, then ROLLS EVERYTHING BACK.
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
        UPDATE public.orders SET extended_status = 'upload' WHERE id = oid;
        report := report || E'\nFAIL 1. Pending -> Upload (skipping Confirmed) was allowed';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 1. skip blocked: ' || SQLERRM;
    END;

    -- 2. moving forward one step at a time must work
    FOREACH s IN ARRAY ARRAY['confirmed', 'upload', 'reconstruction_3d', 'detect_defects'] LOOP
        UPDATE public.orders SET extended_status = s::public.extended_order_status WHERE id = oid;
    END LOOP;
    report := report || E'\nPASS 2. Pending -> Confirmed -> Upload -> 3D Reconstruction -> Detect Defects, one step at a time';

    -- 3. Detect Defects cannot finish without a saved defect scan
    BEGIN
        UPDATE public.orders SET extended_status = 'results' WHERE id = oid;
        report := report || E'\nFAIL 3. Results allowed with no defect scan';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 3. no scan -> blocked: ' || SQLERRM;
    END;

    -- 4. with a (failed) scan the order reaches Results and Recommendation, but cannot be delivered
    INSERT INTO public.detection_logs (order_id, overall_result, created_at) VALUES (oid, 'fail', clock_timestamp());
    UPDATE public.orders SET extended_status = 'results' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'recommendation' WHERE id = oid;
    BEGIN
        UPDATE public.orders SET extended_status = 'delivered' WHERE id = oid;
        report := report || E'\nFAIL 4. a failed item could be delivered';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 4. failed scan -> Results -> Recommendation, delivery blocked';
    END;

    -- 5. corrective action: back to Upload, and the old scan no longer counts
    UPDATE public.orders SET extended_status = 'upload' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'reconstruction_3d' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'detect_defects' WHERE id = oid;
    -- stage times use now(), which is fixed inside one transaction; move the stage start to the real clock for the test
    UPDATE public.order_stage_history SET entered_at = clock_timestamp() WHERE order_id = oid AND left_at IS NULL;
    BEGIN
        UPDATE public.orders SET extended_status = 'results' WHERE id = oid;
        report := report || E'\nFAIL 5. the scan from the previous cycle was accepted';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 5. re-inspection from Upload needs a new scan';
    END;

    -- 6. a passing scan lets the order go all the way to Delivered
    INSERT INTO public.detection_logs (order_id, overall_result, created_at) VALUES (oid, 'pass', clock_timestamp());
    UPDATE public.orders SET extended_status = 'results' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'recommendation' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'delivered' WHERE id = oid;
    report := report || E'\nPASS 6. passing scan -> Results -> Recommendation -> Delivered';

    -- 7. Delivered is final
    BEGIN
        UPDATE public.orders SET extended_status = 'cancelled' WHERE id = oid;
        report := report || E'\nFAIL 7. a delivered order could be cancelled';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 7. Delivered is final: ' || SQLERRM;
    END;

    RAISE EXCEPTION 'FSM TEST REPORT (all test data rolled back):%', report;
END $$;
