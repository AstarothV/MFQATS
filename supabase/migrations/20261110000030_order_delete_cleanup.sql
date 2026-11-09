-- Deleting a cancelled order (admin) takes everything about it with it, for everyone:
-- 1) Tables that were made outside these migrations (order_history_logs, inquiries...) may link to orders in a way that
--    blocks the delete ("violates foreign key constraint"). Every such link to orders now deletes along with the order.
-- 2) The notifications about the order are removed for every account (the customer's too), so nothing points at an
--    order that is gone.
-- Safe to run more than once.

DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT con.conname, con.conrelid::regclass AS tbl,
               regexp_replace(pg_get_constraintdef(con.oid), '\s+ON DELETE (RESTRICT|NO ACTION)', '', 'i') AS def
          FROM pg_constraint con
         WHERE con.contype = 'f' AND con.confrelid = 'public.orders'::regclass AND con.confdeltype IN ('a', 'r')
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON DELETE CASCADE', c.tbl, c.conname, c.def);
        RAISE NOTICE 'Now deleted with its order: %.%', c.tbl, c.conname;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.forget_deleted_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.notifications WHERE entity_id = OLD.id;
    RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.forget_deleted_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_forget_deleted_order ON public.orders;
CREATE TRIGGER trg_forget_deleted_order
    AFTER DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.forget_deleted_order();
