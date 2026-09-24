-- MWQATS Core Schema Migration
-- All 14 entities: users, roles, orders, product_items, production_stages, defects,
-- detection_logs, qa_checklists, time_tracking, inspection_images, rework_logs,
-- audit_logs, notifications, measurements

-- ============================================================
-- STEP 1: ENUM TYPES
-- ============================================================
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('admin', 'staff', 'customer');

DROP TYPE IF EXISTS public.order_status CASCADE;
CREATE TYPE public.order_status AS ENUM ('pending', 'approved', 'in_production', 'quality_check', 'ready_for_delivery', 'delivered', 'cancelled');

DROP TYPE IF EXISTS public.stage_name CASCADE;
CREATE TYPE public.stage_name AS ENUM ('cutting', 'assembly', 'sanding', 'staining', 'finishing', 'quality_check', 'shipping');

DROP TYPE IF EXISTS public.stage_status CASCADE;
CREATE TYPE public.stage_status AS ENUM ('pending', 'in_progress', 'completed', 'delayed', 'rework');

DROP TYPE IF EXISTS public.defect_severity CASCADE;
CREATE TYPE public.defect_severity AS ENUM ('low', 'medium', 'high', 'critical');

DROP TYPE IF EXISTS public.qa_result CASCADE;
CREATE TYPE public.qa_result AS ENUM ('pass', 'fail', 'pending');

DROP TYPE IF EXISTS public.rework_status CASCADE;
CREATE TYPE public.rework_status AS ENUM ('pending', 'in_progress', 'resolved', 'rejected');

DROP TYPE IF EXISTS public.notification_type CASCADE;
CREATE TYPE public.notification_type AS ENUM ('info', 'warning', 'error', 'success');

DROP TYPE IF EXISTS public.measurement_status CASCADE;
CREATE TYPE public.measurement_status AS ENUM ('within_tolerance', 'out_of_tolerance', 'pending');

-- ============================================================
-- STEP 2: CORE TABLES
-- ============================================================

-- user_profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    role public.user_role NOT NULL DEFAULT 'staff',
    department TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_ref TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT '',
    product_category TEXT DEFAULT 'furniture',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status public.order_status NOT NULL DEFAULT 'pending',
    current_stage public.stage_name DEFAULT 'cutting',
    completion_pct INTEGER NOT NULL DEFAULT 0,
    due_date DATE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- product_items (individual workpieces)
CREATE TABLE IF NOT EXISTS public.product_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    workpiece_ref TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    material TEXT DEFAULT '',
    dimensions JSONB DEFAULT '{}',
    current_stage public.stage_name DEFAULT 'cutting',
    status public.stage_status DEFAULT 'pending',
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- production_stages
CREATE TABLE IF NOT EXISTS public.production_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_item_id UUID NOT NULL REFERENCES public.product_items(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    stage_name public.stage_name NOT NULL,
    status public.stage_status NOT NULL DEFAULT 'pending',
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- defects
CREATE TABLE IF NOT EXISTS public.defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_item_id UUID REFERENCES public.product_items(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    stage_name public.stage_name,
    defect_type TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    severity public.defect_severity NOT NULL DEFAULT 'medium',
    confidence_score NUMERIC(5,2) DEFAULT 0,
    bounding_box JSONB DEFAULT '{}',
    recommendation TEXT DEFAULT '',
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    reported_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- detection_logs (YOLO scan results)
CREATE TABLE IF NOT EXISTS public.detection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_item_id UUID REFERENCES public.product_items(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    stage_name public.stage_name,
    inspector_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    scan_mode TEXT NOT NULL DEFAULT 'live_camera',
    image_url TEXT DEFAULT '',
    detections JSONB DEFAULT '[]',
    overall_result public.qa_result DEFAULT 'pending',
    confidence_avg NUMERIC(5,2) DEFAULT 0,
    defect_count INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- qa_checklists
CREATE TABLE IF NOT EXISTS public.qa_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_item_id UUID NOT NULL REFERENCES public.product_items(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    stage_name public.stage_name NOT NULL,
    inspector_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    checklist_items JSONB NOT NULL DEFAULT '[]',
    result public.qa_result NOT NULL DEFAULT 'pending',
    notes TEXT DEFAULT '',
    photo_urls JSONB DEFAULT '[]',
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- time_tracking
CREATE TABLE IF NOT EXISTS public.time_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_item_id UUID REFERENCES public.product_items(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    stage_name public.stage_name,
    staff_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paused_at TIMESTAMPTZ,
    resumed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    is_running BOOLEAN NOT NULL DEFAULT true,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- inspection_images
CREATE TABLE IF NOT EXISTS public.inspection_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_item_id UUID REFERENCES public.product_items(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    stage_name public.stage_name,
    inspector_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT DEFAULT '',
    caption TEXT DEFAULT '',
    tags JSONB DEFAULT '[]',
    is_defect_photo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- rework_logs
CREATE TABLE IF NOT EXISTS public.rework_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_item_id UUID NOT NULL REFERENCES public.product_items(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    stage_name public.stage_name,
    defect_id UUID REFERENCES public.defects(id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT '',
    rework_status public.rework_status NOT NULL DEFAULT 'pending',
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL DEFAULT '',
    entity_type TEXT DEFAULT '',
    entity_id UUID,
    old_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    notification_type public.notification_type NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT false,
    entity_type TEXT DEFAULT '',
    entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- measurements (AR dimension data)
CREATE TABLE IF NOT EXISTS public.measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_item_id UUID REFERENCES public.product_items(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.production_stages(id) ON DELETE SET NULL,
    inspector_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    width_cm NUMERIC(8,2),
    height_cm NUMERIC(8,2),
    depth_cm NUMERIC(8,2),
    length_cm NUMERIC(8,2),
    thickness_cm NUMERIC(8,2),
    angle_degrees NUMERIC(6,2),
    expected_width_cm NUMERIC(8,2),
    expected_height_cm NUMERIC(8,2),
    expected_depth_cm NUMERIC(8,2),
    tolerance_cm NUMERIC(4,2) DEFAULT 1.0,
    variance_width NUMERIC(8,2),
    variance_height NUMERIC(8,2),
    variance_depth NUMERIC(8,2),
    measurement_status public.measurement_status NOT NULL DEFAULT 'pending',
    unit TEXT NOT NULL DEFAULT 'cm',
    notes TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- inventory
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_ref TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    supplier TEXT DEFAULT '',
    stock_level INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'units',
    location TEXT DEFAULT '',
    cost_per_unit NUMERIC(10,2) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 3: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_product_items_order_id ON public.product_items(order_id);
CREATE INDEX IF NOT EXISTS idx_product_items_assigned_to ON public.product_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_production_stages_product_item_id ON public.production_stages(product_item_id);
CREATE INDEX IF NOT EXISTS idx_defects_order_id ON public.defects(order_id);
CREATE INDEX IF NOT EXISTS idx_detection_logs_order_id ON public.detection_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_qa_checklists_product_item_id ON public.qa_checklists(product_item_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_staff_id ON public.time_tracking(staff_id);
CREATE INDEX IF NOT EXISTS idx_inspection_images_order_id ON public.inspection_images(order_id);
CREATE INDEX IF NOT EXISTS idx_rework_logs_order_id ON public.rework_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_measurements_product_item_id ON public.measurements(product_item_id);

-- ============================================================
-- STEP 4: FUNCTIONS
-- ============================================================

-- Auto-create user_profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.user_role,
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Role check helper (safe - queries auth.users not user_profiles)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT COALESCE(raw_user_meta_data->>'role', 'staff')
FROM auth.users
WHERE id = auth.uid()
$$;

-- Admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT COALESCE(raw_user_meta_data->>'role', 'staff') = 'admin'
FROM auth.users
WHERE id = auth.uid()
$$;

-- Staff or admin check
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT COALESCE(raw_user_meta_data->>'role', 'staff') IN ('admin', 'staff')
FROM auth.users
WHERE id = auth.uid()
$$;

-- ============================================================
-- STEP 5: ENABLE RLS
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rework_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: RLS POLICIES
-- ============================================================

-- user_profiles: own row + admin sees all
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile" ON public.user_profiles
FOR ALL TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- orders: customers see own, staff/admin see all
DROP POLICY IF EXISTS "orders_access" ON public.orders;
CREATE POLICY "orders_access" ON public.orders
FOR ALL TO authenticated
USING (
    public.is_staff_or_admin() OR customer_id = auth.uid()
)
WITH CHECK (
    public.is_staff_or_admin() OR customer_id = auth.uid()
);

-- product_items: staff/admin full, customer read-only via order
DROP POLICY IF EXISTS "product_items_access" ON public.product_items;
CREATE POLICY "product_items_access" ON public.product_items
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "product_items_customer_read" ON public.product_items;
CREATE POLICY "product_items_customer_read" ON public.product_items
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = product_items.order_id AND o.customer_id = auth.uid()
    )
);

-- production_stages: staff/admin full
DROP POLICY IF EXISTS "production_stages_access" ON public.production_stages;
CREATE POLICY "production_stages_access" ON public.production_stages
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

-- defects: staff/admin full
DROP POLICY IF EXISTS "defects_access" ON public.defects;
CREATE POLICY "defects_access" ON public.defects
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

-- detection_logs: staff/admin full
DROP POLICY IF EXISTS "detection_logs_access" ON public.detection_logs;
CREATE POLICY "detection_logs_access" ON public.detection_logs
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

-- qa_checklists: staff/admin full, customer read-only
DROP POLICY IF EXISTS "qa_checklists_staff_access" ON public.qa_checklists;
CREATE POLICY "qa_checklists_staff_access" ON public.qa_checklists
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "qa_checklists_customer_read" ON public.qa_checklists;
CREATE POLICY "qa_checklists_customer_read" ON public.qa_checklists
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = qa_checklists.order_id AND o.customer_id = auth.uid()
    )
);

-- time_tracking: own records + admin sees all
DROP POLICY IF EXISTS "time_tracking_access" ON public.time_tracking;
CREATE POLICY "time_tracking_access" ON public.time_tracking
FOR ALL TO authenticated
USING (staff_id = auth.uid() OR public.is_admin())
WITH CHECK (staff_id = auth.uid() OR public.is_admin());

-- inspection_images: staff/admin full, customer read-only
DROP POLICY IF EXISTS "inspection_images_staff_access" ON public.inspection_images;
CREATE POLICY "inspection_images_staff_access" ON public.inspection_images
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "inspection_images_customer_read" ON public.inspection_images;
CREATE POLICY "inspection_images_customer_read" ON public.inspection_images
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = inspection_images.order_id AND o.customer_id = auth.uid()
    )
);

-- rework_logs: staff/admin full
DROP POLICY IF EXISTS "rework_logs_access" ON public.rework_logs;
CREATE POLICY "rework_logs_access" ON public.rework_logs
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

-- audit_logs: admin only
DROP POLICY IF EXISTS "audit_logs_admin_access" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_access" ON public.audit_logs
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- notifications: own only
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- measurements: staff/admin full, customer read-only
DROP POLICY IF EXISTS "measurements_staff_access" ON public.measurements;
CREATE POLICY "measurements_staff_access" ON public.measurements
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "measurements_customer_read" ON public.measurements;
CREATE POLICY "measurements_customer_read" ON public.measurements
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = measurements.order_id AND o.customer_id = auth.uid()
    )
);

-- inventory: staff/admin full
DROP POLICY IF EXISTS "inventory_access" ON public.inventory;
CREATE POLICY "inventory_access" ON public.inventory
FOR ALL TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

-- ============================================================
-- STEP 7: TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_product_items_updated_at ON public.product_items;
CREATE TRIGGER set_product_items_updated_at
    BEFORE UPDATE ON public.product_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_production_stages_updated_at ON public.production_stages;
CREATE TRIGGER set_production_stages_updated_at
    BEFORE UPDATE ON public.production_stages
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_time_tracking_updated_at ON public.time_tracking;
CREATE TRIGGER set_time_tracking_updated_at
    BEFORE UPDATE ON public.time_tracking
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_measurements_updated_at ON public.measurements;
CREATE TRIGGER set_measurements_updated_at
    BEFORE UPDATE ON public.measurements
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- STEP 8: MOCK DATA
-- ============================================================
DO $$
DECLARE
    admin_uuid UUID := gen_random_uuid();
    staff_uuid UUID := gen_random_uuid();
    staff2_uuid UUID := gen_random_uuid();
    customer_uuid UUID := gen_random_uuid();
    order1_uuid UUID := gen_random_uuid();
    order2_uuid UUID := gen_random_uuid();
    order3_uuid UUID := gen_random_uuid();
    item1_uuid UUID := gen_random_uuid();
    item2_uuid UUID := gen_random_uuid();
    item3_uuid UUID := gen_random_uuid();
    item4_uuid UUID := gen_random_uuid();
BEGIN
    -- Auth users (trigger creates user_profiles automatically)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'sunita.kapoor@mvcawood.com', crypt('Admin@2026', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'Sunita Kapoor', 'role', 'admin'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (staff_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'marcos.reyes@mvcawood.com', crypt('Staff@2026', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'Marcos Reyes', 'role', 'staff'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (staff2_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'james.thompson@mvcawood.com', crypt('Staff@2026', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'James Thompson', 'role', 'staff'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (customer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'claire.leblanc@gmail.com', crypt('Customer@2026', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'Claire Leblanc', 'role', 'customer'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
    ON CONFLICT (id) DO NOTHING;

    -- Orders
    INSERT INTO public.orders (id, order_ref, customer_id, customer_name, product_name, product_category, amount, status, current_stage, completion_pct, due_date, notes)
    VALUES
        (order1_uuid, 'ORD-4421', customer_uuid, 'Claire Leblanc', 'Oak Dining Table', 'furniture', 2160.00, 'in_production', 'sanding', 45, '2026-05-18', 'Priority order - customer requested rush delivery'),
        (order2_uuid, 'ORD-4418', customer_uuid, 'Mark Walton', 'Walnut Bookshelf Unit', 'furniture', 1420.00, 'quality_check', 'quality_check', 80, '2026-05-15', 'Standard finish requested'),
        (order3_uuid, 'ORD-4409', customer_uuid, 'Nina Park', 'Cherry Side Table', 'furniture', 980.00, 'ready_for_delivery', 'shipping', 95, '2026-05-16', 'Ready for pickup')
    ON CONFLICT (id) DO NOTHING;

    -- Product items
    INSERT INTO public.product_items (id, order_id, workpiece_ref, name, material, current_stage, status, assigned_to, priority)
    VALUES
        (item1_uuid, order1_uuid, 'WP-2847', 'Oak Dining Table Top', 'Oak', 'sanding', 'in_progress', staff_uuid, 'urgent'),
        (item2_uuid, order1_uuid, 'WP-2848', 'Oak Dining Table Legs', 'Oak', 'assembly', 'completed', staff_uuid, 'urgent'),
        (item3_uuid, order2_uuid, 'WP-2851', 'Walnut Bookshelf Frame', 'Walnut', 'quality_check', 'in_progress', staff2_uuid, 'normal'),
        (item4_uuid, order3_uuid, 'WP-2839', 'Cherry Side Table', 'Cherry', 'finishing', 'completed', staff_uuid, 'low')
    ON CONFLICT (id) DO NOTHING;

    -- Production stages for item1
    INSERT INTO public.production_stages (product_item_id, order_id, stage_name, status, assigned_to, started_at, completed_at, duration_minutes)
    VALUES
        (item1_uuid, order1_uuid, 'cutting', 'completed', staff_uuid, now() - interval '5 days', now() - interval '4 days 16 hours', 38),
        (item1_uuid, order1_uuid, 'assembly', 'completed', staff_uuid, now() - interval '4 days', now() - interval '3 days 12 hours', 72),
        (item1_uuid, order1_uuid, 'sanding', 'in_progress', staff_uuid, now() - interval '1 day', null, 84)
    ON CONFLICT (id) DO NOTHING;

    -- Defects
    INSERT INTO public.defects (product_item_id, order_id, stage_name, defect_type, description, severity, confidence_score, recommendation, is_resolved, reported_by)
    VALUES
        (item1_uuid, order1_uuid, 'sanding', 'scratch', 'Surface scratch detected on table top', 'medium', 94.0, 'Sand with 220-grit and re-inspect', false, staff_uuid),
        (item3_uuid, order2_uuid, 'assembly', 'joint_misalignment', 'Rear-left corner joint misaligned by 2mm', 'high', 88.0, 'Disassemble and realign joint', false, staff2_uuid)
    ON CONFLICT (id) DO NOTHING;

    -- Detection logs
    INSERT INTO public.detection_logs (product_item_id, order_id, stage_name, inspector_id, scan_mode, detections, overall_result, confidence_avg, defect_count)
    VALUES
        (item1_uuid, order1_uuid, 'sanding', staff_uuid, 'live_camera',
         '[{"class_name":"scratch","confidence_score":94.0,"severity":"medium","recommendation":"Sand with 220-grit"}]'::jsonb,
         'fail', 94.0, 1),
        (item4_uuid, order3_uuid, 'finishing', staff_uuid, 'image_upload',
         '[]'::jsonb,
         'pass', 0, 0)
    ON CONFLICT (id) DO NOTHING;

    -- QA Checklists
    INSERT INTO public.qa_checklists (product_item_id, order_id, stage_name, inspector_id, checklist_items, result, notes)
    VALUES
        (item1_uuid, order1_uuid, 'sanding', staff_uuid,
         '[{"id":"c1","label":"Start with 80-grit sandpaper","done":true},{"id":"c2","label":"Sand along wood grain","done":true},{"id":"c3","label":"Progress to 120-grit","done":true},{"id":"c4","label":"Final pass with 220-grit","done":false},{"id":"c5","label":"Vacuum dust and wipe","done":false},{"id":"c6","label":"Take QA inspection photo","done":false}]'::jsonb,
         'pending', 'In progress - 3 of 6 checks complete'),
        (item4_uuid, order3_uuid, 'finishing', staff_uuid,
         '[{"id":"f1","label":"Apply first coat of finish","done":true},{"id":"f2","label":"Allow 2h drying time","done":true},{"id":"f3","label":"Light sand between coats","done":true},{"id":"f4","label":"Apply final coat","done":true},{"id":"f5","label":"Final inspection","done":true}]'::jsonb,
         'pass', 'All checks passed - approved for shipping')
    ON CONFLICT (id) DO NOTHING;

    -- Time tracking
    INSERT INTO public.time_tracking (product_item_id, order_id, stage_name, staff_id, started_at, elapsed_seconds, is_running)
    VALUES
        (item1_uuid, order1_uuid, 'sanding', staff_uuid, now() - interval '1 hour 24 minutes', 5040, true)
    ON CONFLICT (id) DO NOTHING;

    -- Inspection images
    INSERT INTO public.inspection_images (product_item_id, order_id, stage_name, inspector_id, image_url, caption, tags)
    VALUES
        (item1_uuid, order1_uuid, 'sanding', staff_uuid,
         'https://img.rocket.new/generatedImages/rocket_gen_img_1388d488a-1772061255574.png',
         'Table top surface - smooth finish confirmed', '["Surface","Sanding"]'::jsonb),
        (item1_uuid, order1_uuid, 'assembly', staff_uuid,
         'https://img.rocket.new/generatedImages/rocket_gen_img_1c0ff60ee-1772127213017.png',
         'Leg joint inspection - no gaps', '["Joints","Assembly"]'::jsonb),
        (item4_uuid, order3_uuid, 'finishing', staff_uuid,
         'https://img.rocket.new/generatedImages/rocket_gen_img_17dd68d7f-1772064496383.png',
         'Final finish coat applied', '["Finishing","QA"]'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    -- Rework logs
    INSERT INTO public.rework_logs (product_item_id, order_id, stage_name, reason, rework_status, assigned_to, created_by)
    VALUES
        (item3_uuid, order2_uuid, 'assembly', 'Joint misalignment at rear-left corner exceeds 2mm tolerance', 'in_progress', staff2_uuid, staff2_uuid)
    ON CONFLICT (id) DO NOTHING;

    -- Audit logs
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES
        (admin_uuid, 'user_login', 'auth', admin_uuid, jsonb_build_object('email', 'sunita.kapoor@mvcawood.com', 'role', 'admin')),
        (staff_uuid, 'stage_update', 'production_stages', item1_uuid, jsonb_build_object('stage', 'sanding', 'status', 'in_progress')),
        (staff_uuid, 'defect_reported', 'defects', item1_uuid, jsonb_build_object('defect_type', 'scratch', 'severity', 'medium'))
    ON CONFLICT (id) DO NOTHING;

    -- Notifications
    INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type)
    VALUES
        (admin_uuid, 'QA Queue Rising', '3 orders awaiting final inspection', 'warning', 'orders'),
        (admin_uuid, 'Low Stock Alert', 'Cherry Wood Veneer below minimum stock level', 'warning', 'inventory'),
        (staff_uuid, 'Task Assigned', 'WP-2847 Oak Dining Table assigned to you for sanding', 'info', 'product_items'),
        (customer_uuid, 'Order Update', 'Your order ORD-4421 is now in the sanding stage', 'info', 'orders')
    ON CONFLICT (id) DO NOTHING;

    -- Measurements
    INSERT INTO public.measurements (product_item_id, order_id, inspector_id, width_cm, height_cm, depth_cm, expected_width_cm, expected_height_cm, expected_depth_cm, tolerance_cm, variance_width, variance_height, variance_depth, measurement_status, notes)
    VALUES
        (item1_uuid, order1_uuid, staff_uuid, 119.5, 75.0, 89.5, 120.0, 75.0, 90.0, 1.0, -0.5, 0.0, -0.5, 'within_tolerance', 'Measurements within 1cm tolerance'),
        (item3_uuid, order2_uuid, staff2_uuid, 118.0, 200.0, 30.0, 120.0, 200.0, 30.0, 1.0, -2.0, 0.0, 0.0, 'out_of_tolerance', 'Width variance exceeds tolerance - rework required')
    ON CONFLICT (id) DO NOTHING;

    -- Inventory
    INSERT INTO public.inventory (item_ref, name, category, supplier, stock_level, min_stock, unit, location, cost_per_unit)
    VALUES
        ('MAT-1001', 'Oak Wood Planks', 'Wood', 'TimberCorp', 245, 100, 'boards', 'Warehouse A-12', 45.00),
        ('MAT-1002', 'Cherry Wood Veneer', 'Wood', 'Premium Woods Inc', 67, 80, 'sheets', 'Warehouse B-05', 28.50),
        ('MAT-1003', 'Brass Hardware Kit', 'Hardware', 'MetalWorks Ltd', 0, 50, 'kits', 'Warehouse C-08', 12.00),
        ('MAT-1004', 'Wood Finish - Satin', 'Finishing', 'FinishMasters', 89, 75, 'gallons', 'Warehouse D-03', 35.00),
        ('MAT-1005', 'Maple Wood Boards', 'Wood', 'TimberCorp', 156, 80, 'boards', 'Warehouse A-08', 38.00),
        ('MAT-1006', 'Walnut Veneer', 'Wood', 'Premium Woods Inc', 23, 60, 'sheets', 'Warehouse B-12', 52.00),
        ('MAT-1007', 'Sandpaper Set 80-220', 'Tools', 'ToolMart', 340, 100, 'packs', 'Workshop B-01', 8.50),
        ('MAT-1008', 'Wood Stain - Dark Walnut', 'Finishing', 'FinishMasters', 42, 30, 'gallons', 'Warehouse D-05', 28.00)
    ON CONFLICT (item_ref) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 9: CREATE PROFILES FOR EXISTING AUTH USERS
-- ============================================================
-- This handles test accounts that may have been created before the trigger was in place
DO $$
BEGIN
    -- Create profiles for any existing auth.users that don't have profiles yet
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
    SELECT 
        u.id,
        u.email,
        COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
        CASE 
            WHEN u.email = 'sunita.kapoor@mvcawood.com' THEN 'admin'::public.user_role
            WHEN u.email = 'marcos.reyes@mvcawood.com' THEN 'staff'::public.user_role
            WHEN u.email = 'claire.leblanc@gmail.com' THEN 'customer'::public.user_role
            ELSE COALESCE(u.raw_user_meta_data->>'role', 'staff')::public.user_role
        END,
        true
    FROM auth.users u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_profiles up WHERE up.id = u.id
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Existing user profiles created successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Existing user profile creation failed (non-blocking): %', SQLERRM;
END $$;
