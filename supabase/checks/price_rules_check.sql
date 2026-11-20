-- Self-check of migration 041 (price rules): a product shown in the shop cannot have a price of 0, and an
-- archived one can. Results are raised at the end, so nothing is kept. Run on a throw-away copy.
DO $$
DECLARE p UUID; r TEXT := 'REMOVE CHECK';
BEGIN
  ALTER TABLE public.products DROP CONSTRAINT products_price_positive, DROP CONSTRAINT products_original_price_ok;
  INSERT INTO public.products (product_ref, name, category, price, original_price) VALUES ('BAD', 'Chair', 'Chairs', 0, -22) RETURNING id INTO p;
  ALTER TABLE public.products ADD CONSTRAINT products_price_positive CHECK (NOT is_active OR price > 0) NOT VALID;
  ALTER TABLE public.products ADD CONSTRAINT products_original_price_ok CHECK (NOT is_active OR original_price IS NULL OR original_price = 0 OR original_price >= price) NOT VALID;
  BEGIN UPDATE public.products SET name = 'Chair 2' WHERE id = p; r := r || E'\nFAIL edit kept a 0 price';
  EXCEPTION WHEN others THEN r := r || E'\nPASS editing a shown product with 0 price -> refused'; END;
  BEGIN UPDATE public.products SET is_active = false WHERE id = p; r := r || E'\nPASS removing it works';
  EXCEPTION WHEN others THEN r := r || E'\nFAIL remove refused: ' || SQLERRM; END;
  BEGIN INSERT INTO public.products (product_ref, name, category, price) VALUES ('Z', 'Free', 'Chairs', 0); r := r || E'\nFAIL new 0 price saved';
  EXCEPTION WHEN others THEN r := r || E'\nPASS new product at 0 -> refused'; END;
  RAISE EXCEPTION '%', r;
END $$;
