-- More catalog items (12): IKEA products with their own names, photos and measurements, priced in pesos on the
-- same scale as the existing catalog. They start with no reviews (IKEA's reviews are not this shop's).
-- Safe to run more than once: rows that already exist (same product_ref) are skipped.

WITH admin AS (
    SELECT id FROM public.user_profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1
)
INSERT INTO public.products (
    product_ref, name, description, category, price, original_price,
    height_cm, width_cm, length_cm, material_type,
    images, availability, estimated_production_days,
    specifications, ar_model_support, tags, rating, review_count, is_active, created_by
) VALUES
    ('PRD-1007', 'LISABO Table', 'Dining table in ash veneer on solid birch legs. Its lightweight core keeps it strong, stable and easy to move.', 'Tables', 9000, 9000,
     74.0, 78.1, 140.0, 'Ash veneer, solid birch legs',
     '["https://www.ikea.com/us/en/images/products/lisabo-table-ash-veneer__0737105_pe740883_s5.jpg", "https://www.ikea.com/us/en/images/products/lisabo-table-ash-veneer__1470751_pe996928_s5.jpg", "https://www.ikea.com/us/en/images/products/lisabo-table-ash-veneer__1470763_pe996937_s5.jpg", "https://www.ikea.com/us/en/images/products/lisabo-table-ash-veneer__1255121_pe924441_s5.jpg"]'::jsonb, 'available', 14,
     '{"finish": "Tinted clear lacquer"}'::jsonb, false, '["IKEA", "Tables"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1008', 'LISABO Chair', 'Sturdy dining chair with an ash veneer seat and back on solid birch legs.', 'Chairs', 2400, 2400,
     80.0, 51.1, 46.0, 'Ash veneer, solid birch',
     '["https://www.ikea.com/us/en/images/products/lisabo-chair-ash__0786549_pe763015_s5.jpg", "https://www.ikea.com/us/en/images/products/lisabo-chair-ash__0946416_ph171423_s5.jpg", "https://www.ikea.com/us/en/images/products/lisabo-chair-ash__1053174_pe846767_s5.jpg", "https://www.ikea.com/us/en/images/products/lisabo-chair-ash__1053175_pe846725_s5.jpg"]'::jsonb, 'available', 10,
     '{"seat_height": "45 cm", "finish": "Tinted clear lacquer"}'::jsonb, false, '["IKEA", "Chairs"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1009', 'SKOGSTA Chair', 'Clear-lacquered solid acacia chair with an arched backrest and spindles.', 'Chairs', 2100, 2100,
     94.0, 54.9, 46.0, 'Solid acacia',
     '["https://www.ikea.com/us/en/images/products/skogsta-chair-acacia__1542800_pe1018531_s5.jpg", "https://www.ikea.com/us/en/images/products/skogsta-chair-acacia__1342684_pe949087_s5.jpg", "https://www.ikea.com/us/en/images/products/skogsta-chair-acacia__1342683_pe949088_s5.jpg", "https://www.ikea.com/us/en/images/products/skogsta-chair-acacia__1481590_pe1000560_s5.jpg"]'::jsonb, 'available', 10,
     '{"seat_height": "46 cm", "finish": "Clear lacquer"}'::jsonb, false, '["IKEA", "Chairs"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1010', 'TONSTAD Bed Frame', 'Queen bed frame in brushed oak veneer, with a modern and timeless look.', 'Beds', 12000, 12000,
     115.9, 161.0, 211.1, 'Oak veneer',
     '["https://www.ikea.com/us/en/images/products/tonstad-bed-frame-oak-veneer__1385644_pe963600_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-bed-frame-oak-veneer__1419004_pe976809_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-bed-frame-oak-veneer__1419007_pe976812_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-bed-frame-oak-veneer__1419006_pe976811_s5.jpg"]'::jsonb, 'available', 21,
     '{"size": "Queen", "mattress": "152 x 202 cm"}'::jsonb, false, '["IKEA", "Beds"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1011', 'IDANÄS Bed Frame', 'Queen bed frame with a tall headboard, traditional details and a dark-brown stain.', 'Beds', 12000, 12000,
     112.1, 162.9, 208.9, 'Solid pine, beech veneer',
     '["https://www.ikea.com/us/en/images/products/idanaes-bed-frame-dark-brown-stained__0916066_pe784942_s5.jpg", "https://www.ikea.com/us/en/images/products/idanaes-bed-frame-dark-brown-stained__0932344_pe791460_s5.jpg", "https://www.ikea.com/us/en/images/products/idanaes-bed-frame-dark-brown-stained__1063809_ph182861_s5.jpg", "https://www.ikea.com/us/en/images/products/idanaes-bed-frame-dark-brown-stained__1063810_ph182860_s5.jpg"]'::jsonb, 'available', 21,
     '{"size": "Queen", "finish": "Dark-brown stain"}'::jsonb, false, '["IKEA", "Beds"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1012', 'BILLY / OXBERG Bookcase', 'Tall bookcase with panel and glass doors, to show some things and hide the rest.', 'Storage', 5700, 5700,
     201.9, 29.8, 80.0, 'Walnut effect',
     '["https://www.ikea.com/us/en/images/products/billy-oxberg-bookcase-with-panel-glass-doors-brown-walnut-effect__1602176_pe1043268_s5.jpg", "https://www.ikea.com/us/en/images/products/billy-oxberg-bookcase-with-panel-glass-doors-brown-walnut-effect__1415028_pe975049_s5.jpg", "https://www.ikea.com/us/en/images/products/billy-oxberg-bookcase-with-panel-glass-doors-brown-walnut-effect__1415029_pe975050_s5.jpg", "https://www.ikea.com/us/en/images/products/billy-oxberg-bookcase-with-panel-glass-doors-brown-walnut-effect__1104598_pe867764_s5.jpg"]'::jsonb, 'available', 14,
     '{"doors": "Panel and glass"}'::jsonb, false, '["IKEA", "Storage"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1013', 'KALLAX Shelving Unit', 'Shelving unit with two doors and four drawers. Stands upright or lies down as a sideboard.', 'Storage', 5100, 5100,
     76.5, 39.1, 146.4, 'White stained oak effect',
     '["https://www.ikea.com/us/en/images/products/kallax-shelving-unit-with-2-doors-4-drawers-white-stained-oak-effect__0480295_pe618865_s5.jpg", "https://www.ikea.com/us/en/images/products/kallax-shelving-unit-with-2-doors-4-drawers-white-stained-oak-effect__1102541_pe867020_s5.jpg", "https://www.ikea.com/us/en/images/products/kallax-shelving-unit-with-2-doors-4-drawers-white-stained-oak-effect__1102472_pe866997_s5.jpg", "https://www.ikea.com/us/en/images/products/kallax-shelving-unit-with-2-doors-4-drawers-white-stained-oak-effect__1415092_pe975113_s5.jpg"]'::jsonb, 'available', 12,
     '{"compartments": "8", "doors": "2", "drawers": "4"}'::jsonb, false, '["IKEA", "Storage"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1014', 'TONSTAD Desk', 'Narrow desk in brushed oak veneer, for work, hobbies or as a hallway table.', 'Office Furniture', 9000, 9000,
     74.9, 47.0, 120.0, 'Oak veneer',
     '["https://www.ikea.com/us/en/images/products/tonstad-desk-oak-veneer__1243899_pe921026_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-desk-oak-veneer__1319690_pe940967_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-desk-oak-veneer__1248723_pe923199_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-desk-oak-veneer__1476965_pe999081_s5.jpg"]'::jsonb, 'available', 14,
     '{"finish": "Clear lacquer"}'::jsonb, false, '["IKEA", "Office Furniture"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1015', 'MITTZON Desk', 'Desk with a walnut veneer top on a black steel frame. The height is set during assembly, from 65 to 85 cm.', 'Office Furniture', 11400, 11400,
     85.1, 60.0, 160.0, 'Walnut veneer, steel frame',
     '["https://www.ikea.com/us/en/images/products/mittzon-desk-walnut-veneer-black__1209380_pe909176_s5.jpg", "https://www.ikea.com/us/en/images/products/mittzon-desk-walnut-veneer-black__1274537_pe930366_s5.jpg", "https://www.ikea.com/us/en/images/products/mittzon-desk-walnut-veneer-black__1274538_pe930367_s5.jpg", "https://www.ikea.com/us/en/images/products/mittzon-desk-walnut-veneer-black__1302665_pe938124_s5.jpg"]'::jsonb, 'available', 14,
     '{"height_range": "65-85 cm"}'::jsonb, false, '["IKEA", "Office Furniture"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1016', 'TONSTAD Cabinet', 'Cabinet in brushed oak veneer with sliding doors and two adjustable shelves.', 'Cabinets', 8700, 8700,
     120.0, 37.1, 81.6, 'Oak veneer',
     '["https://www.ikea.com/us/en/images/products/tonstad-cabinet-with-sliding-doors-oak-veneer__1186254_pe898736_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-cabinet-with-sliding-doors-oak-veneer__1301584_pe937484_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-cabinet-with-sliding-doors-oak-veneer__1300155_pe936988_s5.jpg", "https://www.ikea.com/us/en/images/products/tonstad-cabinet-with-sliding-doors-oak-veneer__1346456_pe950936_s5.jpg"]'::jsonb, 'available', 16,
     '{"doors": "2 sliding", "shelves": "2 adjustable"}'::jsonb, false, '["IKEA", "Cabinets"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1017', 'RÅDMANSÖ Cabinet', 'Mid-century style cabinet with open and closed storage and a brass-look knob.', 'Cabinets', 9000, 9000,
     103.2, 48.6, 118.4, 'Walnut effect',
     '["https://www.ikea.com/us/en/images/products/radmansoe-cabinet-brown-walnut-effect__1417025_pe975801_s5.jpg", "https://www.ikea.com/us/en/images/products/radmansoe-cabinet-brown-walnut-effect__1445531_pe988272_s5.jpg", "https://www.ikea.com/us/en/images/products/radmansoe-cabinet-brown-walnut-effect__1445530_pe988273_s5.jpg", "https://www.ikea.com/us/en/images/products/radmansoe-cabinet-brown-walnut-effect__1445529_pe988274_s5.jpg"]'::jsonb, 'available', 16,
     '{"finish": "Brown walnut effect"}'::jsonb, false, '["IKEA", "Cabinets"]'::jsonb, 0, 0, true, (SELECT id FROM admin)),
    ('PRD-1018', 'STOCKHOLM 2025 Sideboard', 'Sideboard in oak veneer with generous storage and wooden drawer runners.', 'Cabinets', 18000, 18000,
     83.2, 41.9, 160.7, 'Oak veneer',
     '["https://www.ikea.com/us/en/images/products/stockholm-2025-sideboard-oak-veneer__1397699_pe967720_s5.jpg", "https://www.ikea.com/us/en/images/products/stockholm-2025-sideboard-oak-veneer__1425273_ph203050_s5.jpg", "https://www.ikea.com/us/en/images/products/stockholm-2025-sideboard-oak-veneer__1424765_ph203051_s5.jpg", "https://www.ikea.com/us/en/images/products/stockholm-2025-sideboard-oak-veneer__1425275_ph203052_s5.jpg"]'::jsonb, 'available', 18,
     '{"finish": "Clear lacquer"}'::jsonb, false, '["IKEA", "Cabinets"]'::jsonb, 0, 0, true, (SELECT id FROM admin))
ON CONFLICT (product_ref) DO NOTHING;
