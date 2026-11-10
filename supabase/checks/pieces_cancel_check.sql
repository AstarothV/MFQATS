-- Self-test for chair sets (every piece inspected), customer cancel requests, and deleting a cancelled order.
-- Paste into Supabase > SQL Editor > Run. It creates throw-away users and orders, checks the rules, then ROLLS
-- EVERYTHING BACK: the red "error" box is on purpose and nothing is changed. Every line should start with PASS.

DO $$
DECLARE
    cust UUID := gen_random_uuid();
    other UUID := gen_random_uuid();
    adm UUID := gen_random_uuid();
    oid UUID;
    o2 UUID;
    p TEXT;
    n INT;
    report TEXT := '';
BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        (cust, 'test-cust-' || cust || '@example.com', jsonb_build_object('full_name', 'Test Customer', 'role', 'customer')),
        (other, 'test-other-' || other || '@example.com', jsonb_build_object('full_name', 'Other Customer', 'role', 'customer')),
        (adm, 'test-admin-' || adm || '@example.com', jsonb_build_object('full_name', 'Test Admin', 'role', 'customer'));
    INSERT INTO public.user_profiles (id, email, full_name, role)
        SELECT id, email, raw_user_meta_data->>'full_name', 'customer' FROM auth.users WHERE id IN (cust, other, adm)
        ON CONFLICT (id) DO NOTHING;
    UPDATE public.user_profiles SET role = 'admin' WHERE id = adm;

    -- 1. a set of 4 chairs becomes 4 pieces
    INSERT INTO public.orders (order_ref, customer_id, product_name, product_category, quantity, items)
    VALUES ('SET-TEST-' || gen_random_uuid(), cust, 'Ash Dining Chair', 'Chairs', 4,
            '[{"name":"Ash Dining Chair","category":"Chairs","quantity":4}]')
    RETURNING id INTO oid;
    SELECT cardinality(pieces) INTO n FROM public.orders WHERE id = oid;
    report := report || CASE WHEN n = 4 THEN E'\nPASS 1. set of 4 chairs -> 4 pieces: ' ELSE E'\nFAIL 1. pieces: ' END
              || (SELECT array_to_string(pieces, ', ') FROM public.orders WHERE id = oid);

    -- 2. Detect Defects needs a scan for every piece
    UPDATE public.orders SET extended_status = 'confirmed' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'upload' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'reconstruction_3d' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'detect_defects' WHERE id = oid;
    UPDATE public.order_stage_history SET entered_at = clock_timestamp() - interval '1 second' WHERE order_id = oid AND left_at IS NULL;
    FOREACH p IN ARRAY (SELECT pieces[1:3] FROM public.orders WHERE id = oid) LOOP
        INSERT INTO public.detection_logs (order_id, piece, overall_result, created_at) VALUES (oid, p, 'pass', clock_timestamp());
    END LOOP;
    BEGIN
        UPDATE public.orders SET extended_status = 'results' WHERE id = oid;
        report := report || E'\nFAIL 2. Results allowed with 3 of 4 chairs scanned';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 2. 3 of 4 chairs scanned -> blocked: ' || SQLERRM;
    END;

    -- 3. one failed chair blocks delivery
    INSERT INTO public.detection_logs (order_id, piece, overall_result, created_at)
        VALUES (oid, (SELECT pieces[4] FROM public.orders WHERE id = oid), 'fail', clock_timestamp());
    UPDATE public.orders SET extended_status = 'results' WHERE id = oid;
    UPDATE public.orders SET extended_status = 'recommendation' WHERE id = oid;
    BEGIN
        UPDATE public.orders SET extended_status = 'delivered' WHERE id = oid;
        report := report || E'\nFAIL 3. delivered with a failed chair';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 3. one chair failed -> delivery blocked: ' || SQLERRM;
    END;

    -- 4. cancel request: a reason is required, only the owner can ask, admins are told
    INSERT INTO public.orders (order_ref, customer_id, product_name, product_category, quantity)
    VALUES ('CANCEL-TEST-' || gen_random_uuid(), cust, 'Oak Writing Desk', 'Office Furniture', 1) RETURNING id INTO o2;
    PERFORM set_config('request.jwt.claim.sub', cust::text, true);
    BEGIN
        PERFORM public.request_order_cancel(o2, '');
        report := report || E'\nFAIL 4a. cancel request without a reason was accepted';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 4a. no reason -> refused: ' || SQLERRM;
    END;
    PERFORM set_config('request.jwt.claim.sub', other::text, true);
    BEGIN
        PERFORM public.request_order_cancel(o2, 'I changed my mind');
        report := report || E'\nFAIL 4b. another customer could cancel this order';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 4b. another customer -> refused: ' || SQLERRM;
    END;
    PERFORM set_config('request.jwt.claim.sub', cust::text, true);
    PERFORM public.request_order_cancel(o2, 'I changed my mind');
    IF (SELECT cancel_requested_at IS NOT NULL AND cancel_reason = 'I changed my mind' FROM public.orders WHERE id = o2)
       AND EXISTS (SELECT 1 FROM public.notifications WHERE user_id = adm AND entity_id = o2) THEN
        report := report || E'\nPASS 4c. request saved with its reason; the admin got a notification';
    ELSE
        report := report || E'\nFAIL 4c. request or admin notification missing';
    END IF;

    -- 5. only an admin can approve; approval cancels the order
    BEGIN
        PERFORM public.approve_order_cancel(o2);
        report := report || E'\nFAIL 5a. the customer approved their own cancellation';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 5a. customer cannot approve: ' || SQLERRM;
    END;
    PERFORM set_config('request.jwt.claim.sub', adm::text, true);
    PERFORM public.approve_order_cancel(o2);
    report := report || CASE WHEN (SELECT extended_status FROM public.orders WHERE id = o2) = 'cancelled'
        THEN E'\nPASS 5b. admin approved -> order Cancelled' ELSE E'\nFAIL 5b. order not cancelled' END;

    -- 6. a non-Pending order cannot be cancelled by request
    PERFORM set_config('request.jwt.claim.sub', cust::text, true);
    BEGIN
        PERFORM public.request_order_cancel(oid, 'Too late');
        report := report || E'\nFAIL 6. an order in production could be cancelled';
    EXCEPTION WHEN others THEN
        report := report || E'\nPASS 6. order in production -> refused: ' || SQLERRM;
    END;

    -- 7. deleting the cancelled order removes its notifications for everyone
    SELECT count(*) INTO n FROM public.notifications WHERE entity_id = o2;
    DELETE FROM public.orders WHERE id = o2;
    report := report || CASE WHEN n > 0 AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE entity_id = o2)
        THEN format(E'\nPASS 7. cancelled order deleted; its %s notification(s) removed', n)
        ELSE format(E'\nFAIL 7. notifications before %s, after %s', n, (SELECT count(*) FROM public.notifications WHERE entity_id = o2)) END;

    RAISE EXCEPTION 'PIECES + CANCEL TEST REPORT (all test data rolled back):%', report;
END $$;
