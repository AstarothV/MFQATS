-- 1) The last process stage is now shown as "Re-check / Finishing": the admin re-checks the results and approves the
--    finished piece, or it is sent back to be fixed and inspected again. The stored value stays 'recommendation', so
--    existing orders, their stage history and the stage rules (FSM) keep working unchanged.
-- 2) One conversation per order between the customer, the staff and the admin (the existing messages table):
--    customers read and write only on their own orders, staff and admins on all orders. Each message keeps who sent
--    it and the stage the order was at, and the other side gets a notification.
-- Safe to run more than once.

-- ---------- 1. stage label ----------
CREATE OR REPLACE FUNCTION public.order_status_label(p_status public.extended_order_status)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_status
        WHEN 'pending' THEN 'Pending'
        WHEN 'confirmed' THEN 'Confirmed'
        WHEN 'upload' THEN 'Upload'
        WHEN 'reconstruction_3d' THEN '3D Reconstruction'
        WHEN 'detect_defects' THEN 'Detect Defects'
        WHEN 'results' THEN 'Results'
        WHEN 'recommendation' THEN 'Re-check / Finishing'
        WHEN 'delivered' THEN 'Delivered'
        WHEN 'cancelled' THEN 'Cancelled'
    END;
$$;

-- ---------- 2. order conversation ----------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_role TEXT NOT NULL DEFAULT '';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT '';

-- can this person see the order's conversation?
CREATE OR REPLACE FUNCTION public.can_see_order_chat(p_order UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_staff_or_admin()
        OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = p_order AND o.customer_id = auth.uid());
$$;

DROP POLICY IF EXISTS "messages_access" ON public.messages;
DROP POLICY IF EXISTS "messages_read" ON public.messages;
DROP POLICY IF EXISTS "messages_send" ON public.messages;
DROP POLICY IF EXISTS "messages_mark_read" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;

CREATE POLICY "messages_read" ON public.messages FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.can_see_order_chat(order_id));

-- you can only post as yourself, and only into a conversation you can see
CREATE POLICY "messages_send" ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND (order_id IS NULL OR public.can_see_order_chat(order_id)));

-- marking messages read; the trigger below keeps everything else unchanged
CREATE POLICY "messages_mark_read" ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.can_see_order_chat(order_id))
WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.can_see_order_chat(order_id));

CREATE POLICY "messages_delete" ON public.messages FOR DELETE TO authenticated
USING (public.is_admin());

-- who sent it and at which stage (customers cannot read staff profiles, so the name is kept on the message)
CREATE OR REPLACE FUNCTION public.fill_message_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    SELECT COALESCE(NULLIF(full_name, ''), 'MVCA WoodWorks'), role::text
      INTO NEW.sender_name, NEW.sender_role
      FROM public.user_profiles WHERE id = NEW.sender_id;
    IF NEW.order_id IS NOT NULL THEN
        SELECT extended_status::text INTO NEW.stage FROM public.orders WHERE id = NEW.order_id;
    END IF;
    NEW.sender_name := COALESCE(NEW.sender_name, 'MVCA WoodWorks');
    NEW.sender_role := COALESCE(NEW.sender_role, '');
    NEW.stage := COALESCE(NEW.stage, '');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_message_details ON public.messages;
CREATE TRIGGER trg_fill_message_details
    BEFORE INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.fill_message_details();

-- after sending, only "read" can change: nobody edits someone else's words
CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.content := OLD.content;
    NEW.sender_id := OLD.sender_id;
    NEW.receiver_id := OLD.receiver_id;
    NEW.order_id := OLD.order_id;
    NEW.sender_name := OLD.sender_name;
    NEW.sender_role := OLD.sender_role;
    NEW.stage := OLD.stage;
    NEW.attachment_url := OLD.attachment_url;
    NEW.attachment_name := OLD.attachment_name;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_message_update ON public.messages;
CREATE TRIGGER trg_guard_message_update
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();

-- tell the other side: a customer's message goes to the assigned staff and the admins, a staff/admin message to the
-- customer
CREATE OR REPLACE FUNCTION public.notify_order_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    o RECORD;
    preview TEXT := left(NEW.content, 120);
BEGIN
    IF NEW.order_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT id, order_ref, customer_id, assigned_to INTO o FROM public.orders WHERE id = NEW.order_id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    IF NEW.sender_role = 'customer' THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        SELECT u.id, 'New message from the customer', format('Order %s: %s', o.order_ref, preview), 'info', 'order', o.id
          FROM public.user_profiles u
         WHERE u.id <> NEW.sender_id AND u.is_active
           AND (u.role = 'admin' OR u.id = o.assigned_to);
    ELSIF o.customer_id IS NOT NULL AND o.customer_id <> NEW.sender_id THEN
        INSERT INTO public.notifications (user_id, title, message, notification_type, entity_type, entity_id)
        VALUES (o.customer_id, 'New message about your order', format('Order %s: %s', o.order_ref, preview), 'info', 'order', o.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_message ON public.messages;
CREATE TRIGGER trg_notify_order_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_order_message();

-- messages sent before this update get their sender's name and role too (the guard above keeps names fixed, so it is
-- paused for this one backfill)
ALTER TABLE public.messages DISABLE TRIGGER trg_guard_message_update;
UPDATE public.messages m
   SET sender_name = COALESCE(NULLIF(u.full_name, ''), 'MVCA WoodWorks'), sender_role = u.role::text
  FROM public.user_profiles u
 WHERE u.id = m.sender_id AND m.sender_name = '';
ALTER TABLE public.messages ENABLE TRIGGER trg_guard_message_update;

-- live updates for the conversation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END;
$$;
