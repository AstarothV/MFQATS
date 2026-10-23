-- Which parts of the schema exist in this database (were the migrations in supabase/migrations applied?).
-- Read-only. Supabase -> SQL Editor -> paste -> Run.
SELECT 'order statuses (extended_order_status)' AS what,
       coalesce((SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
                 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'extended_order_status'), 'MISSING') AS result
UNION ALL
SELECT 'statuses orders actually have now',
       coalesce((SELECT string_agg(extended_status::text || ' x' || n, ', ')
                 FROM (SELECT extended_status, count(*) AS n FROM public.orders GROUP BY 1) x), 'no orders')
UNION ALL
SELECT 'FSM table: order_status_transitions (migration 20260927000003)',
       CASE WHEN to_regclass('public.order_status_transitions') IS NULL THEN 'MISSING' ELSE 'present' END
UNION ALL
SELECT 'stage time tracking: order_stage_history (20260927000004)',
       CASE WHEN to_regclass('public.order_stage_history') IS NULL THEN 'MISSING' ELSE 'present' END
UNION ALL
SELECT 'PERT/WMA function: stage_timeline_stats (20260927000004)',
       CASE WHEN to_regprocedure('public.stage_timeline_stats(integer,integer)') IS NULL THEN 'MISSING' ELSE 'present' END
UNION ALL
SELECT 'scan follow-ups: after_quality_scan (20260930000006)',
       CASE WHEN to_regprocedure('public.after_quality_scan()') IS NULL THEN 'MISSING' ELSE 'present' END
UNION ALL
SELECT 'detection_logs rows by result',
       coalesce((SELECT string_agg(overall_result::text || ' x' || n, ', ')
                 FROM (SELECT overall_result, count(*) AS n FROM public.detection_logs GROUP BY 1) x), 'no rows');
