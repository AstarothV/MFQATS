-- The customer's OrderView shows the real work on their order: the inspection photos (Photo Gallery) and the 3D model
-- (3D Preview). The files go in a private storage bucket: staff and admins can use all of it, a customer can only read
-- the folder of their own orders (<order id>/...). The website opens them with links that expire.
-- Safe to run again.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS model_3d_path TEXT; -- where the order's 3D model is, in the bucket

INSERT INTO storage.buckets (id, name, public)
VALUES ('order-media', 'order-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "order_media_staff_access" ON storage.objects;
CREATE POLICY "order_media_staff_access" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'order-media' AND public.is_staff_or_admin())
WITH CHECK (bucket_id = 'order-media' AND public.is_staff_or_admin());

DROP POLICY IF EXISTS "order_media_customer_read" ON storage.objects;
CREATE POLICY "order_media_customer_read" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'order-media' AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id::TEXT = (storage.foldername(name))[1] AND o.customer_id = auth.uid()
    )
);
