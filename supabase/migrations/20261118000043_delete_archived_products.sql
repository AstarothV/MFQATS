-- Product Catalog: an admin can delete a product for good, but only one that is archived (hidden from the shop).
-- Orders keep their product name and items (orders.product_id becomes empty); the product leaves any cart.
-- Safe to run more than once.
CREATE OR REPLACE FUNCTION public.delete_only_archived_products()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF OLD.is_active THEN
        RAISE EXCEPTION 'Archive % first: only archived products can be deleted', OLD.name;
    END IF;
    RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_delete_only_archived_products ON public.products;
CREATE TRIGGER trg_delete_only_archived_products BEFORE DELETE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.delete_only_archived_products();
