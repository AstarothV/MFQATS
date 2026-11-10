-- Remove what the first design created and the system no longer uses (nothing in the app reads or writes these):
--   otp_codes          two-step sign-in uses Supabase Auth's own authenticator codes
--   product_items      orders are inspected by their pieces (orders.pieces, detection_logs.piece)
--   production_stages  stage times are recorded in order_stage_history
--   time_tracking      same: order_stage_history, filled in automatically on every stage move
--   qa_checklists      the stage checklists come from the order's stage, photos and scans
--   measurements       belonged to the removed photo measuring (PnP)
-- Also the links to product_items in the inspection tables, and the two status types only those tables used.
-- Their policies, indexes and triggers go with them. Safe to run more than once.

ALTER TABLE public.detection_logs   DROP COLUMN IF EXISTS product_item_id;
ALTER TABLE public.defects          DROP COLUMN IF EXISTS product_item_id;
ALTER TABLE public.rework_logs      DROP COLUMN IF EXISTS product_item_id;
ALTER TABLE public.inspection_images DROP COLUMN IF EXISTS product_item_id;

DROP TABLE IF EXISTS public.otp_codes CASCADE;
DROP TABLE IF EXISTS public.measurements CASCADE;
DROP TABLE IF EXISTS public.qa_checklists CASCADE;
DROP TABLE IF EXISTS public.time_tracking CASCADE;
DROP TABLE IF EXISTS public.production_stages CASCADE;
DROP TABLE IF EXISTS public.product_items CASCADE;

-- the types are dropped only when nothing else uses them
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['measurement_status', 'stage_status'] LOOP
        CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = t AND typnamespace = 'public'::regnamespace);
        IF NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
                           WHERE a.atttypid = ('public.' || t)::regtype AND NOT a.attisdropped AND c.relkind IN ('r', 'v', 'm'))
           AND NOT EXISTS (SELECT 1 FROM pg_proc p WHERE ('public.' || t)::regtype = ANY (p.proargtypes) OR p.prorettype = ('public.' || t)::regtype) THEN
            EXECUTE format('DROP TYPE public.%I', t);
            RAISE NOTICE 'Removed type %', t;
        END IF;
    END LOOP;
END;
$$;
