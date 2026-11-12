-- A realistic limit on how much one order can hold. The shop allows at most 12 chairs, 10 office pieces or 5 of any
-- other product per item (src/lib/pieces.ts maxQty); this stops an order sent around the shop from asking for more.
-- NOT VALID: existing orders are not re-checked, only new and changed ones.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_quantity_cap;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_quantity_cap CHECK (quantity IS NULL OR quantity BETWEEN 1 AND 60) NOT VALID;

-- each item of the order, by its category
CREATE OR REPLACE FUNCTION public.order_items_within_cap(items jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(bool_and(
    COALESCE((i->>'quantity')::int, 1) BETWEEN 1 AND
      CASE i->>'category' WHEN 'Chairs' THEN 12 WHEN 'Office Furniture' THEN 10 ELSE 5 END), true)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END) AS i
$$;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_items_cap;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_items_cap CHECK (items IS NULL OR public.order_items_within_cap(items)) NOT VALID;
