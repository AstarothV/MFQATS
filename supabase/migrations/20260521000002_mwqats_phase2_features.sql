-- MWQATS Phase 2 Features Migration
-- Adds: products, cart_items, messages, otp_codes tables
-- New order statuses, product catalog with full fields

-- ============================================================
-- STEP 1: NEW ENUM TYPES
-- ============================================================

DROP TYPE IF EXISTS public.product_availability CASCADE;
CREATE TYPE public.product_availability AS ENUM ('available', 'limited', 'out_of_stock', 'discontinued');

DROP TYPE IF EXISTS public.cart_status CASCADE;
CREATE TYPE public.cart_status AS ENUM ('active', 'checked_out', 'abandoned');

DROP TYPE IF EXISTS public.message_status CASCADE;
CREATE TYPE public.message_status AS ENUM ('sent', 'delivered', 'read');

DROP TYPE IF EXISTS public.extended_order_status CASCADE;
CREATE TYPE public.extended_order_status AS ENUM (
  'pending', 'confirmed', 'designing', 'material_preparation',
  'cutting', 'assembly', 'sanding', 'finishing',
  'quality_inspection', 'ready_for_delivery', 'delivered', 'cancelled'
);

-- ============================================================
-- STEP 2: NEW TABLES
-- ============================================================

-- products catalog
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_ref TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'furniture',
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    original_price NUMERIC(12,2) DEFAULT 0,
    height_cm NUMERIC(8,2) DEFAULT 0,
    width_cm NUMERIC(8,2) DEFAULT 0,
    length_cm NUMERIC(8,2) DEFAULT 0,
    material_type TEXT DEFAULT '',
    images JSONB DEFAULT '[]',
    model_3d_url TEXT DEFAULT '',
    availability public.product_availability NOT NULL DEFAULT 'available',
    estimated_production_days INTEGER DEFAULT 14,
    specifications JSONB DEFAULT '{}',
    ar_model_support BOOLEAN NOT NULL DEFAULT false,
    tags JSONB DEFAULT '[]',
    rating NUMERIC(3,2) DEFAULT 4.5,
    review_count INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- cart_items
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    customization_notes TEXT DEFAULT '',
    status public.cart_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- messages (chat system)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL DEFAULT '',
    attachment_url TEXT DEFAULT '',
    attachment_name TEXT DEFAULT '',
    status public.message_status NOT NULL DEFAULT 'sent',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- otp_codes (2FA)
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add product_id to orders for proper linking
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_city TEXT DEFAULT '';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_phone TEXT DEFAULT '';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customization_notes TEXT DEFAULT '';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS extended_status public.extended_order_status DEFAULT 'pending';

-- ============================================================
-- STEP 3: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_availability ON public.products(availability);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_cart_items_customer_id ON public.cart_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_status ON public.cart_items(status);
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON public.messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON public.otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON public.otp_codes(expires_at);

-- ============================================================
-- STEP 4: FUNCTIONS
-- ============================================================

-- Customer check (safe - queries auth.users)
CREATE OR REPLACE FUNCTION public.is_customer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT COALESCE(raw_user_meta_data->>'role', 'staff') = 'customer'
FROM auth.users
WHERE id = auth.uid()
$$;

-- Updated_at for products
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 5: ENABLE RLS
-- ============================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: RLS POLICIES
-- ============================================================

-- products: public read, admin/staff write
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
FOR SELECT TO authenticated
USING (is_active = true OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "products_admin_write" ON public.products;
CREATE POLICY "products_admin_write" ON public.products
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- cart_items: customers manage own cart
DROP POLICY IF EXISTS "cart_items_own" ON public.cart_items;
CREATE POLICY "cart_items_own" ON public.cart_items
FOR ALL TO authenticated
USING (customer_id = auth.uid() OR public.is_staff_or_admin())
WITH CHECK (customer_id = auth.uid() OR public.is_staff_or_admin());

-- messages: sender/receiver/admin can access
DROP POLICY IF EXISTS "messages_access" ON public.messages;
CREATE POLICY "messages_access" ON public.messages
FOR ALL TO authenticated
USING (
    sender_id = auth.uid() OR
    receiver_id = auth.uid() OR
    public.is_staff_or_admin()
)
WITH CHECK (
    sender_id = auth.uid() OR
    public.is_staff_or_admin()
);

-- otp_codes: own only
DROP POLICY IF EXISTS "otp_codes_own" ON public.otp_codes;
CREATE POLICY "otp_codes_own" ON public.otp_codes
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Also allow anon to read otp for verification (needed for pre-auth OTP check)
DROP POLICY IF EXISTS "otp_codes_anon_read" ON public.otp_codes;
CREATE POLICY "otp_codes_anon_read" ON public.otp_codes
FOR SELECT TO anon
USING (false);

-- ============================================================
-- STEP 7: TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER set_cart_items_updated_at
    BEFORE UPDATE ON public.cart_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- STEP 8: MOCK PRODUCT DATA
-- ============================================================
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    SELECT id INTO admin_user_id FROM public.user_profiles WHERE role = 'admin' LIMIT 1;

    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.products (
            product_ref, name, description, category, price, original_price,
            height_cm, width_cm, length_cm, material_type, images,
            availability, estimated_production_days, specifications,
            ar_model_support, tags, rating, review_count, is_active, created_by
        ) VALUES
        (
            'PRD-1001', 'Oak Dining Table', 'Solid oak dining table with elegant curved legs and premium satin finish. Handcrafted by master woodworkers.',
            'Tables', 1240.00, 1399.00, 75.0, 90.0, 180.0, 'Solid Oak',
            '["https://img.rocket.new/generatedImages/rocket_gen_img_13d329e25-1772441226671.png"]'::jsonb,
            'available', 14,
            '{"seats": "6-8 persons", "finish": "Natural Satin", "joinery": "Mortise and Tenon", "warranty": "2 years"}'::jsonb,
            true, '["Custom", "Premium", "Dining"]'::jsonb, 4.8, 24, true, admin_user_id
        ),
        (
            'PRD-1002', 'Walnut Bookshelf Unit', 'Modern walnut bookshelf with 5 adjustable shelves and clean minimalist design.',
            'Storage', 890.00, 890.00, 200.0, 30.0, 120.0, 'Solid Walnut',
            '["https://img.rocket.new/generatedImages/rocket_gen_img_17c6d1e91-1772199203166.png"]'::jsonb,
            'available', 10,
            '{"shelves": "5 adjustable", "finish": "Dark Walnut", "load_capacity": "30kg per shelf", "warranty": "1 year"}'::jsonb,
            true, '["Storage", "Modern", "Walnut"]'::jsonb, 4.6, 18, true, admin_user_id
        ),
        (
            'PRD-1003', 'Cherry Coffee Table', 'Cherry wood coffee table with hidden storage compartment and tapered legs.',
            'Tables', 650.00, 720.00, 45.0, 60.0, 120.0, 'Cherry Wood',
            '["https://img.rocket.new/generatedImages/rocket_gen_img_164fe4caf-1764651052330.png"]'::jsonb,
            'available', 7,
            '{"storage": "Hidden compartment", "finish": "Cherry Stain", "legs": "Tapered solid cherry", "warranty": "2 years"}'::jsonb,
            true, '["Tables", "Cherry", "Storage"]'::jsonb, 4.7, 31, true, admin_user_id
        ),
        (
            'PRD-1004', 'Maple Study Desk', 'Ergonomic maple wood study desk with 2 drawers and integrated cable management.',
            'Office Furniture', 730.00, 730.00, 75.0, 60.0, 140.0, 'Maple Wood',
            '["https://img.rocket.new/generatedImages/rocket_gen_img_12bcfdb41-1767335243808.png"]'::jsonb,
            'limited', 12,
            '{"drawers": "2 deep drawers", "finish": "Natural Maple", "cable_management": "Built-in tray", "warranty": "1 year"}'::jsonb,
            false, '["Desk", "Office", "Ergonomic"]'::jsonb, 4.5, 15, true, admin_user_id
        ),
        (
            'PRD-1005', 'Pine Side Chair', 'Handcrafted pine chair with upholstered seat cushion and curved back support.',
            'Chairs', 190.00, 220.00, 90.0, 50.0, 55.0, 'Pine Wood',
            '["https://img.rocket.new/generatedImages/rocket_gen_img_19a47c875-1772205011474.png"]'::jsonb,
            'available', 5,
            '{"upholstery": "Linen fabric", "finish": "Natural Pine", "weight_capacity": "120kg", "warranty": "1 year"}'::jsonb,
            false, '["Chair", "Handcrafted", "Pine"]'::jsonb, 4.4, 22, true, admin_user_id
        ),
        (
            'PRD-1006', 'Cherry Bed Frame', 'Luxury cherrywood bed frame with low-profile rails and reinforced mortise joinery.',
            'Beds', 1580.00, 1800.00, 120.0, 160.0, 210.0, 'Cherry Wood',
            '["https://img.rocket.new/generatedImages/rocket_gen_img_105d53b9a-1772882308126.png"]'::jsonb,
            'available', 21,
            '{"size": "Queen/King", "finish": "Cherry Stain", "joinery": "Mortise and Tenon", "warranty": "5 years"}'::jsonb,
            true, '["Bed", "Luxury", "Cherry"]'::jsonb, 4.9, 8, true, admin_user_id
        )
        ON CONFLICT (product_ref) DO NOTHING;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Product mock data insertion failed: %', SQLERRM;
END $$;
