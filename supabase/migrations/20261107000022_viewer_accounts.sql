-- View-only accounts for the survey: people can open every Admin, Staff and Customer page and see how orders are
-- processed, but the database refuses any change they try (add, edit, delete, upload).
-- Each viewer mirrors a demo person, so its pages are not empty:
--   viewer.admin@mvcawood.com    -> sees what Sunita Kapoor (admin) sees, including her notifications
--   viewer.staff@mvcawood.com    -> sees Marcos Reyes's assigned tasks, scans and notifications
--   viewer.customer@mvcawood.com -> sees Claire Leblanc's orders, inspection photos, chat and notifications
-- "View only" is kept in the account's app_metadata, which only the server can change (a person cannot edit it from
-- the website), and it travels inside every sign-in token, so each request is checked.
--
-- Before running: Supabase -> Authentication -> Users -> Add user -> Create new user, once for each of the three
-- emails above, with a password, and "Auto Confirm User" ticked.
-- To turn a viewer into a normal account again (or remove the view-only mark):
--   UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'viewer' - 'view_as' WHERE email = '...';
-- Safe to run more than once.

-- ---------- 1. who is a viewer, and whose data they see ----------
CREATE OR REPLACE FUNCTION public.is_viewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'viewer') = 'true', false)
$$;

-- the demo person a viewer mirrors (null for everyone else)
CREATE OR REPLACE FUNCTION public.viewing_as()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT CASE WHEN public.is_viewer() THEN NULLIF(auth.jwt() -> 'app_metadata' ->> 'view_as', '')::UUID END
$$;

-- ---------- 2. viewers cannot change anything ----------
-- RESTRICTIVE policies are added on top of the existing ones for adding, editing and deleting, on every table with
-- row level security and on stored files. Reading is not touched.
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT c.relname
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS viewer_no_insert ON public.%I', t.relname);
        EXECUTE format('DROP POLICY IF EXISTS viewer_no_update ON public.%I', t.relname);
        EXECUTE format('DROP POLICY IF EXISTS viewer_no_delete ON public.%I', t.relname);
        EXECUTE format('CREATE POLICY viewer_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
                       'WITH CHECK (NOT (SELECT public.is_viewer()))', t.relname);
        EXECUTE format('CREATE POLICY viewer_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
                       'USING (NOT (SELECT public.is_viewer()))', t.relname);
        EXECUTE format('CREATE POLICY viewer_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated '
                       'USING (NOT (SELECT public.is_viewer()))', t.relname);
    END LOOP;
END;
$$;

DROP POLICY IF EXISTS viewer_no_insert ON storage.objects;
DROP POLICY IF EXISTS viewer_no_update ON storage.objects;
DROP POLICY IF EXISTS viewer_no_delete ON storage.objects;
CREATE POLICY viewer_no_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (NOT (SELECT public.is_viewer()));
CREATE POLICY viewer_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
    USING (NOT (SELECT public.is_viewer()));
CREATE POLICY viewer_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
    USING (NOT (SELECT public.is_viewer()));

-- ---------- 3. viewers read what their demo person can read ----------
-- Staff and admin viewers already see every order through their role; these add the customer's own things and
-- everyone's notifications.
DROP POLICY IF EXISTS viewer_mirror_read ON public.orders;
CREATE POLICY viewer_mirror_read ON public.orders FOR SELECT TO authenticated
    USING (customer_id = (SELECT public.viewing_as()));

DROP POLICY IF EXISTS viewer_mirror_read ON public.order_stage_history;
CREATE POLICY viewer_mirror_read ON public.order_stage_history FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_stage_history.order_id AND o.customer_id = (SELECT public.viewing_as())));

DROP POLICY IF EXISTS viewer_mirror_read ON public.product_items;
CREATE POLICY viewer_mirror_read ON public.product_items FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = product_items.order_id AND o.customer_id = (SELECT public.viewing_as())));

DROP POLICY IF EXISTS viewer_mirror_read ON public.inspection_images;
CREATE POLICY viewer_mirror_read ON public.inspection_images FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = inspection_images.order_id AND o.customer_id = (SELECT public.viewing_as())));

DROP POLICY IF EXISTS viewer_mirror_read ON public.messages;
CREATE POLICY viewer_mirror_read ON public.messages FOR SELECT TO authenticated
    USING (sender_id = (SELECT public.viewing_as()) OR receiver_id = (SELECT public.viewing_as())
           OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = messages.order_id AND o.customer_id = (SELECT public.viewing_as())));

DROP POLICY IF EXISTS viewer_mirror_read ON public.notifications;
CREATE POLICY viewer_mirror_read ON public.notifications FOR SELECT TO authenticated
    USING (user_id = (SELECT public.viewing_as()));

DROP POLICY IF EXISTS viewer_mirror_read ON public.cart_items;
CREATE POLICY viewer_mirror_read ON public.cart_items FOR SELECT TO authenticated
    USING (customer_id = (SELECT public.viewing_as()));

-- the order's photos and 3D model (files in <order id>/...)
DROP POLICY IF EXISTS order_media_viewer_read ON storage.objects;
CREATE POLICY order_media_viewer_read ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'order-media' AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id::TEXT = (storage.foldername(name))[1] AND o.customer_id = (SELECT public.viewing_as())
    )
);

-- the customer's estimated completion date (same as before, plus the mirrored customer)
CREATE OR REPLACE FUNCTION public.order_eta(p_order_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cur public.extended_order_status;
    since TIMESTAMPTZ;
    remaining_hours NUMERIC;
BEGIN
    -- only the order's customer (or the viewer mirroring them), staff and admins may see its estimate
    SELECT o.extended_status INTO cur FROM public.orders o
    WHERE o.id = p_order_id
      AND (o.customer_id = auth.uid() OR o.customer_id = public.viewing_as() OR public.is_staff_or_admin()
           OR auth.uid() IS NULL);  -- NULL = SQL Editor (anon is revoked)
    IF NOT FOUND OR cur IN ('delivered', 'cancelled') THEN
        RETURN NULL;
    END IF;

    SELECT h.entered_at INTO since FROM public.order_stage_history h
    WHERE h.order_id = p_order_id AND h.left_at IS NULL
    ORDER BY h.entered_at DESC LIMIT 1;

    SELECT SUM(CASE WHEN s.status = cur
                    THEN GREATEST(s.expected_hours - EXTRACT(EPOCH FROM (now() - COALESCE(since, now()))) / 3600.0, 0)
                    ELSE s.expected_hours END)
    INTO remaining_hours
    FROM public.stage_timeline_stats() s
    WHERE s.status >= cur AND s.status < 'delivered';

    RETURN now() + make_interval(secs => (COALESCE(remaining_hours, 0) * 3600)::DOUBLE PRECISION);
END;
$$;

-- the order conversation (per-stage questions)
CREATE OR REPLACE FUNCTION public.can_see_order_chat(p_order UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_staff_or_admin()
        OR EXISTS (SELECT 1 FROM public.orders o
                   WHERE o.id = p_order AND (o.customer_id = auth.uid() OR o.customer_id = public.viewing_as()));
$$;

-- ---------- 4. make the three accounts viewers ----------
DO $$
DECLARE
    v RECORD;
    done_count INT := 0;
BEGIN
    FOR v IN
        SELECT u.id, x.role, x.name, m.id AS mirror_id
          FROM (VALUES ('viewer.admin@mvcawood.com',    'sunita.kapoor@mvcawood.com', 'admin',    'Viewer (Admin)'),
                       ('viewer.staff@mvcawood.com',    'marcos.reyes@mvcawood.com',  'staff',    'Viewer (Staff)'),
                       ('viewer.customer@mvcawood.com', 'claire.leblanc@gmail.com',   'customer', 'Viewer (Customer)'))
               AS x(viewer, mirror, role, name)
          JOIN auth.users u ON lower(u.email) = x.viewer
          LEFT JOIN auth.users m ON lower(m.email) = x.mirror
    LOOP
        UPDATE auth.users
           SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::JSONB)
                                   || jsonb_build_object('viewer', true, 'view_as', COALESCE(v.mirror_id::TEXT, ''))
         WHERE id = v.id;
        UPDATE public.user_profiles
           SET role = v.role::public.user_role, full_name = v.name, is_active = true
         WHERE id = v.id;
        done_count := done_count + 1;
    END LOOP;
    RAISE NOTICE '% of 3 viewer accounts set up (create the missing ones in Authentication -> Users, then run this again)', done_count;
END;
$$;
