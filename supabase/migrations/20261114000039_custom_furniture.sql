-- Custom furniture: a piece that is not in the catalog (for example a wood table brought in by a customer) can be
-- photographed, made into a 3D model and scanned in Quality Scan with "No order", then kept by the staff member as
-- "My custom furniture". Its files go in the private order-media bucket under custom/<staff id>/, which the existing
-- staff/admin storage rule (migration 011) already covers; customers cannot read them (the folder is not an order).
-- Each staff member sees and changes only their own pieces; admins see all of them.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.custom_furniture (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
    model_path TEXT,                -- the 3D model in order-media
    photo_path TEXT,                -- its front photo in order-media
    scan_result TEXT CHECK (scan_result IN ('pass', 'fail')), -- NULL when it was not scanned
    defect_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_furniture_staff ON public.custom_furniture (staff_id, created_at DESC);

ALTER TABLE public.custom_furniture ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_furniture_read" ON public.custom_furniture;
CREATE POLICY "custom_furniture_read" ON public.custom_furniture FOR SELECT TO authenticated
USING (staff_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "custom_furniture_insert" ON public.custom_furniture;
CREATE POLICY "custom_furniture_insert" ON public.custom_furniture FOR INSERT TO authenticated
WITH CHECK (staff_id = auth.uid() AND public.is_staff_or_admin());

DROP POLICY IF EXISTS "custom_furniture_delete" ON public.custom_furniture;
CREATE POLICY "custom_furniture_delete" ON public.custom_furniture FOR DELETE TO authenticated
USING (staff_id = auth.uid() OR public.is_admin());
