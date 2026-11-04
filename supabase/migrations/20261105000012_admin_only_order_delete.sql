-- Deleting an order: admins only, and only a cancelled order.
-- Before this, one rule ("orders_access", FOR ALL) let staff, admins and the order's own customer do everything,
-- deleting included. Reading, placing and updating stay exactly as they were; only DELETE is narrowed.
-- Deleting an order also deletes what belongs to it (scans, defects, photos records, stage history...) through the
-- existing ON DELETE CASCADE, and the audit log records it. Safe to run again.

DROP POLICY IF EXISTS "orders_access" ON public.orders;
DROP POLICY IF EXISTS "orders_read" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;

CREATE POLICY "orders_read" ON public.orders
FOR SELECT TO authenticated
USING (public.is_staff_or_admin() OR customer_id = auth.uid());

CREATE POLICY "orders_insert" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (public.is_staff_or_admin() OR customer_id = auth.uid());

CREATE POLICY "orders_update" ON public.orders
FOR UPDATE TO authenticated
USING (public.is_staff_or_admin() OR customer_id = auth.uid())
WITH CHECK (public.is_staff_or_admin() OR customer_id = auth.uid());

CREATE POLICY "orders_delete_admin" ON public.orders
FOR DELETE TO authenticated
USING (public.is_admin() AND extended_status = 'cancelled');
