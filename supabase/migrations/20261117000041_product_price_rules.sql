-- Product Catalog: a product cannot be saved at ₱0 or with a negative price (the admin form checks this too).
-- NOT VALID: products already saved that break a rule are left as they are, but must be corrected the next time they
-- are edited; every new product is checked. Safe to run more than once.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_positive;
ALTER TABLE public.products ADD CONSTRAINT products_price_positive CHECK (price > 0) NOT VALID;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_original_price_ok;
ALTER TABLE public.products ADD CONSTRAINT products_original_price_ok CHECK (original_price IS NULL OR original_price = 0 OR original_price >= price) NOT VALID; -- 0: no original price
