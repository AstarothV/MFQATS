-- Preview of supabase/migrations/20261028000008_showcase_prices_photos.sql: every amount now and what it becomes.
-- Read-only, changes nothing.
SELECT 'order' AS kind, order_ref AS ref, product_name AS item, amount AS current_value,
       greatest(100, round(amount * 82400 / 332700 / 100) * 100) AS new_value
FROM public.orders
UNION ALL
SELECT 'product', p.product_ref, p.name, p.price, v.price
FROM public.products p
JOIN (VALUES ('PRD-1001', 24500), ('PRD-1002', 11900), ('PRD-1003', 8500),
             ('PRD-1004', 12800), ('PRD-1005', 3200), ('PRD-1006', 21500)) AS v(product_ref, price)
  ON v.product_ref = p.product_ref
UNION ALL
SELECT 'total revenue', '', 'all orders', sum(amount), sum(greatest(100, round(amount * 82400 / 332700 / 100) * 100))
FROM public.orders
ORDER BY 1, 2;
