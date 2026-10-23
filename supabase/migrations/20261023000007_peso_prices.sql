-- Prices and order amounts in Philippine pesos. The seed data was in US dollars; it becomes pesos at 63 per dollar (rate on 2026-10-23),
-- rounded to the nearest PHP 100 (inventory cost per unit to the nearest PHP 10). Preview first with
-- supabase/checks/peso_prices_preview.sql.
-- Runs once: it only converts while the catalogue still looks like dollars (no product at PHP 10,000 or more), so a
-- second run changes nothing.
DO $$
BEGIN
    IF (SELECT coalesce(max(price), 0) FROM public.products) >= 10000 THEN
        RAISE NOTICE 'Prices are already in pesos; nothing changed.';
        RETURN;
    END IF;
    UPDATE public.orders SET amount = round(amount * 63 / 100) * 100;
    UPDATE public.products SET price = round(price * 63 / 100) * 100,
                               original_price = round(coalesce(original_price, 0) * 63 / 100) * 100;
    UPDATE public.inventory SET cost_per_unit = round(coalesce(cost_per_unit, 0) * 63 / 10) * 10;
    RAISE NOTICE 'Converted to pesos.';
END $$;
