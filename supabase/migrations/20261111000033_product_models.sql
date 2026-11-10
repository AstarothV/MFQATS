-- The shop shows a 3D model of a product next to its photos. An admin picks one of the 3D models the workshop built in
-- Quality Scan (they are private, in "order-media") and the website copies it here, a public bucket, so every
-- shopper can view it. Anyone can read; only admins can add, replace or remove files.
-- Safe to run more than once.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-models', 'product-models', true, 104857600, ARRAY['model/gltf-binary', 'application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600,
    allowed_mime_types = ARRAY['model/gltf-binary', 'application/octet-stream'];

DROP POLICY IF EXISTS "product_models_read" ON storage.objects;
CREATE POLICY "product_models_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'product-models');

DROP POLICY IF EXISTS "product_models_admin_write" ON storage.objects;
CREATE POLICY "product_models_admin_write" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'product-models' AND public.is_admin())
WITH CHECK (bucket_id = 'product-models' AND public.is_admin());
