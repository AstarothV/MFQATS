-- Product Catalog: a product shown in the shop cannot be saved at ₱0 or with a negative price (the admin form checks
-- this too). A removed product (is_active = false) is not checked, so a product saved earlier with a wrong price can
-- still be removed. NOT VALID: products already saved are left as they are, but must be corrected the next time they
-- are edited while shown; every new product is checked. Safe to run more than once (run it again after changing it).
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_positive;
ALTER TABLE public.products ADD CONSTRAINT products_price_positive CHECK (NOT is_active OR price > 0) NOT VALID;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_original_price_ok;
ALTER TABLE public.products ADD CONSTRAINT products_original_price_ok
    CHECK (NOT is_active OR original_price IS NULL OR original_price = 0 OR original_price >= price) NOT VALID; -- 0: no original price
