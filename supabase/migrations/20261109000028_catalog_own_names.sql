-- The shop's own names for the catalog items added in migration 018 (they used IKEA's product names).
-- Plain names that say what each piece is and what it is made of (like "Oak Dining Table"); each keeps the kind of
-- furniture in the name (Chair, Table, Bed Frame...), so the furniture groups and the inside-part suggestions keep working.
-- Also renamed: the same products on existing orders (and their saved items), in old notifications, and the "IKEA" tag.
-- Run after migration 026 (orders.items). Safe to run more than once.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('PRD-1007', 'LISABO Table',             'Ash Dining Table'),
            ('PRD-1008', 'LISABO Chair',             'Ash Dining Chair'),
            ('PRD-1009', 'SKOGSTA Chair',            'Acacia Spindle Chair'),
            ('PRD-1010', 'TONSTAD Bed Frame',        'Oak Queen Bed Frame'),
            ('PRD-1011', 'IDANÄS Bed Frame',         'Tall Headboard Bed Frame'),
            ('PRD-1012', 'BILLY / OXBERG Bookcase',  'Glass-Door Bookcase'),
            ('PRD-1013', 'KALLAX Shelving Unit',     'Cube Shelving Unit'),
            ('PRD-1014', 'TONSTAD Desk',             'Oak Writing Desk'),
            ('PRD-1015', 'MITTZON Desk',             'Walnut and Steel Desk'),
            ('PRD-1016', 'TONSTAD Cabinet',          'Oak Sliding-Door Cabinet'),
            ('PRD-1017', 'RÅDMANSÖ Cabinet',         'Mid-Century Cabinet'),
            ('PRD-1018', 'STOCKHOLM 2025 Sideboard', 'Oak Sideboard')
        ) AS t(ref, old_name, new_name)
    LOOP
        UPDATE public.products
           SET name = r.new_name, tags = COALESCE(tags, '[]'::JSONB) - 'IKEA'
         WHERE product_ref = r.ref;

        -- orders keep a copy of the name: "LISABO Chair", or "LISABO Chair + 2 more"
        UPDATE public.orders
           SET product_name = r.new_name || substr(product_name, length(r.old_name) + 1)
         WHERE product_name = r.old_name OR product_name LIKE r.old_name || ' + %';

        UPDATE public.orders
           SET items = (SELECT jsonb_agg(CASE WHEN e->>'name' = r.old_name THEN jsonb_set(e, '{name}', to_jsonb(r.new_name)) ELSE e END)
                          FROM jsonb_array_elements(items) e)
         WHERE jsonb_typeof(items) = 'array' AND items @> jsonb_build_array(jsonb_build_object('name', r.old_name));

        UPDATE public.notifications
           SET message = replace(message, r.old_name, r.new_name)
         WHERE message LIKE '%' || r.old_name || '%';
    END LOOP;
END;
$$;
