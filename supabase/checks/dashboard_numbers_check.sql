-- The real numbers behind the dashboard cards that are still hardcoded, computed from the database.
-- Read-only: only SELECTs, changes nothing. Supabase -> SQL Editor -> paste -> Run.
WITH process AS (
    SELECT unnest(ARRAY['upload', 'reconstruction_3d', 'detect_defects', 'results', 'recommendation'])::public.extended_order_status AS s
),
stats AS (SELECT * FROM public.stage_timeline_stats()),
finished_visits AS (   -- every time an order went through a stage and left it
    SELECT h.status, extract(epoch FROM h.left_at - h.entered_at) / 3600 AS hours
    FROM public.order_stage_history h
    WHERE h.left_at IS NOT NULL AND h.status IN (SELECT s FROM process)
),
stuck AS (             -- orders in a stage right now for longer than its PERT expected time
    SELECT h.status, count(*) AS orders
    FROM public.order_stage_history h JOIN stats st ON st.status = h.status
    WHERE h.left_at IS NULL AND h.status IN (SELECT s FROM process)
      AND extract(epoch FROM now() - h.entered_at) / 3600 > st.expected_hours
    GROUP BY h.status
),
paid AS (SELECT * FROM public.orders WHERE extended_status IS DISTINCT FROM 'cancelled'),
month_rev AS (
    SELECT date_trunc('month', created_at) AS m, sum(amount) AS revenue
    FROM paid WHERE created_at >= date_trunc('month', now()) - interval '5 months'
    GROUP BY 1
),
this_last AS (
    SELECT coalesce(sum(revenue) FILTER (WHERE m = date_trunc('month', now())), 0) AS this_month,
           coalesce(sum(revenue) FILTER (WHERE m = date_trunc('month', now()) - interval '1 month'), 0) AS last_month
    FROM month_rev
),
insp AS (
    SELECT count(*) FILTER (WHERE overall_result = 'pass') AS passed,
           count(*) FILTER (WHERE overall_result = 'fail') AS failed,
           count(*) FILTER (WHERE overall_result = 'pending') AS pending
    FROM public.detection_logs
)
SELECT n, metric, value FROM (
    SELECT 1 AS n, 'Total WIP: orders in an inspection stage now' AS metric,
           (SELECT count(*) FROM public.orders WHERE extended_status IN (SELECT s FROM process))::text AS value
    UNION ALL
    SELECT 2, 'Avg cycle time per stage (hours, finished stage visits)',
           coalesce((SELECT round(avg(hours), 2) || ' h from ' || count(*) || ' visits' FROM finished_visits HAVING count(*) > 0),
                    'no finished stage visits yet')
    UNION ALL
    SELECT 3, 'Avg cycle time, each stage',
           coalesce((SELECT string_agg(status || ': ' || round(avg_h, 2) || ' h (' || n || ')', ' | ' ORDER BY status)
                     FROM (SELECT status, avg(hours) AS avg_h, count(*) AS n FROM finished_visits GROUP BY status) x),
                    'no finished stage visits yet')
    UNION ALL
    SELECT 4, 'Active bottlenecks: stages with an order past its PERT time',
           (SELECT count(*) FROM stuck) || coalesce(' (' || (SELECT string_agg(status || ': ' || orders || ' order(s)', ', ') FROM stuck) || ')', '')
    UNION ALL
    SELECT 5, 'Inspections: passed / failed / pending',
           (SELECT passed || ' / ' || failed || ' / ' || pending FROM insp)
    UNION ALL
    SELECT 6, 'Quality pass rate (passed / passed+failed)',
           (SELECT CASE WHEN passed + failed = 0 THEN 'no inspections with a verdict yet'
                        ELSE round(100.0 * passed / (passed + failed), 1) || '%' END FROM insp)
    UNION ALL
    SELECT 7, 'Total revenue, ALL orders (what the dashboard should add up)',
           (SELECT to_char(coalesce(sum(amount), 0), 'FM999,999,990.00') || ' from ' || count(*) || ' orders' FROM public.orders)
    UNION ALL
    SELECT 8, 'Total revenue, excluding cancelled orders',
           (SELECT to_char(coalesce(sum(amount), 0), 'FM999,999,990.00') || ' from ' || count(*) || ' orders' FROM paid)
    UNION ALL
    SELECT 9, 'Revenue by month, last 6 months (excluding cancelled)',
           coalesce((SELECT string_agg(to_char(m, 'Mon YYYY') || ': ' || to_char(revenue, 'FM999,999,990.00'), ' | ' ORDER BY m) FROM month_rev),
                    'no orders in the last 6 months')
    UNION ALL
    SELECT 10, 'Revenue growth: this month vs last month',
           (SELECT CASE WHEN last_month = 0 THEN 'no revenue last month, so no % (this month: ' || to_char(this_month, 'FM999,999,990.00') || ')'
                        ELSE round(100 * (this_month - last_month) / last_month, 1) || '%' END FROM this_last)
) t
ORDER BY n;
