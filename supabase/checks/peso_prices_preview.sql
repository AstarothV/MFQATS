-- Preview of supabase/migrations/20261023000007_peso_prices.sql: every amount now and what it becomes. Read-only, changes nothing.
-- The old values were in US dollars; the new ones are pesos at 63 per dollar (rate on 2026-10-23), rounded to the nearest PHP 100
-- (inventory cost per unit to the nearest PHP 10, since those are small).
SELECT 'order' AS kind, order_ref AS ref, product_name AS item,
       amount AS current_value, round(amount * 63 / 100) * 100 AS new_pesos
FROM public.orders
UNION ALL
SELECT 'product', product_ref, name, price, round(price * 63 / 100) * 100 FROM public.products
UNION ALL
SELECT 'product (original price)', product_ref, name, original_price, round(original_price * 63 / 100) * 100
FROM public.products WHERE original_price > 0
UNION ALL
SELECT 'inventory cost/unit', item_ref, name, cost_per_unit, round(cost_per_unit * 63 / 10) * 10 FROM public.inventory
ORDER BY 1, 2;
