-- Showcase catalogue: realistic Philippine furniture prices, several photos per product, and example order amounts to match.
-- The photos are IKEA product photos of similar pieces, for the demo only (MVCA has no product photos online yet); replace
-- them with MVCA's own photos before real customers use the shop. Preview first with
-- supabase/checks/showcase_prices_preview.sql.
-- Runs once: it only changes prices while the old ones are still there (a product at PHP 50,000 or more), so a second run
-- changes nothing. Orders are scaled by how much the whole catalogue went down (PHP 332,700 -> 82,400), to the nearest PHP 100.
DO $$
DECLARE
    img CONSTANT text := 'https://www.ikea.com/us/en/images/products/';
BEGIN
    IF (SELECT coalesce(max(price), 0) FROM public.products) < 50000 THEN
        RAISE NOTICE 'Showcase prices are already in; nothing changed.';
        RETURN;
    END IF;

    UPDATE public.orders SET amount = greatest(100, round(amount * 82400 / 332700 / 100) * 100);

    UPDATE public.products p SET price = v.price, original_price = v.original_price, images = v.images
    FROM (VALUES
        ('PRD-1001', 24500, 27900, jsonb_build_array(
            img || 'moerbylanga-table-oak-veneer-brown-stained__0737108_pe740890_s5.jpg',
            img || 'moerbylanga-table-oak-veneer-brown-stained__1209072_pe909012_s5.jpg',
            img || 'moerbylanga-table-oak-veneer-brown-stained__1143378_pe881483_s5.jpg',
            img || 'moerbylanga-table-oak-veneer-brown-stained__0719380_pe732028_s5.jpg',
            img || 'moerbylanga-table-oak-veneer-brown-stained__0719381_pe732029_s5.jpg',
            img || 'moerbylanga-table-oak-veneer-brown-stained__0871205_pe594901_s5.jpg')),
        ('PRD-1002', 11900, 11900, jsonb_build_array(
            img || 'hemnes-bookcase-black-brown-light-brown__1590299_pe1038938_s5.jpg',
            img || 'hemnes-bookcase-black-brown-light-brown__1052040_pe845891_s5.jpg',
            img || 'hemnes-bookcase-black-brown-light-brown__1586200_pe1037339_s5.jpg',
            img || 'hemnes-bookcase-black-brown-light-brown__1586201_pe1037338_s5.jpg',
            img || 'hemnes-bookcase-black-brown-light-brown__1586199_pe1037337_s5.jpg')),
        ('PRD-1003', 8500, 9500, jsonb_build_array(
            img || 'jakobsfors-coffee-table-dark-brown-stained-oak-veneer__1108164_pe869323_s5.jpg',
            img || 'jakobsfors-coffee-table-dark-brown-stained-oak-veneer__1108167_pe869324_s5.jpg',
            img || 'jakobsfors-coffee-table-dark-brown-stained-oak-veneer__1108169_pe869326_s5.jpg',
            img || 'jakobsfors-coffee-table-dark-brown-stained-oak-veneer__1108168_pe869325_s5.jpg')),
        ('PRD-1004', 12800, 12800, jsonb_build_array(
            img || 'hemnes-desk-white-stain-light-brown__1162629_pe889905_s5.jpg',
            img || 'hemnes-desk-white-stain-light-brown__1176724_pe895116_s5.jpg',
            img || 'hemnes-desk-white-stain-light-brown__1176725_pe895117_s5.jpg',
            img || 'hemnes-desk-white-stain-light-brown__1176726_pe895121_s5.jpg')),
        ('PRD-1005', 3200, 3600, jsonb_build_array(
            img || 'stefan-chair-brown-black__0727320_pe735593_s5.jpg',
            img || 'stefan-chair-brown-black__1052538_pe846195_s5.jpg',
            img || 'stefan-chair-brown-black__1052539_pe846166_s5.jpg',
            img || 'stefan-chair-brown-black__0872007_pe590671_s5.jpg',
            img || 'stefan-chair-brown-black__1052537_pe846194_s5.jpg',
            img || 'stefan-chair-brown-black__0719926_ph154435_s5.jpg')),
        ('PRD-1006', 21500, 24000, jsonb_build_array(
            img || 'malm-bed-frame-dark-brown-veneer__1364772_pe956028_s5.jpg',
            img || 'malm-bed-frame-dark-brown-veneer__1364773_pe956029_s5.jpg',
            img || 'malm-bed-frame-dark-brown-veneer__1364771_pe956027_s5.jpg',
            img || 'malm-bed-frame-dark-brown-veneer__1364775_pe956031_s5.jpg',
            img || 'malm-bed-frame-dark-brown-veneer__1364774_pe956030_s5.jpg'))
    ) AS v(product_ref, price, original_price, images)
    WHERE p.product_ref = v.product_ref;

    -- the old descriptions named details the new photos do not show
    UPDATE public.products SET description = 'Solid oak dining table with sturdy frame legs and a natural satin finish. Handcrafted by master woodworkers.'
    WHERE product_ref = 'PRD-1001';
    UPDATE public.products SET description = 'Round cherry wood coffee table with a lower shelf and angled legs.',
                               specifications = specifications || '{"storage": "Lower shelf"}'::jsonb
    WHERE product_ref = 'PRD-1003';
    UPDATE public.products SET description = 'Handcrafted solid pine chair with a slatted back and a smooth wooden seat.',
                               specifications = (specifications - 'upholstery') || '{"seat": "Solid wood"}'::jsonb
    WHERE product_ref = 'PRD-1005';

    RAISE NOTICE 'Showcase prices and photos are in.';
END $$;
