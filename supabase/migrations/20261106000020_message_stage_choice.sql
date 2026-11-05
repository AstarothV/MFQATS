-- Questions per inspection stage: a message can be about a chosen stage (e.g. a question about Upload while the order is
-- already at Results). The stage sent with the message is kept when it is a real stage of the process; otherwise the
-- order's current stage is used, as before (migration 20261106000017).
-- Safe to run more than once.

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
    IF NEW.order_id IS NOT NULL
       AND COALESCE(NEW.stage, '') NOT IN ('upload', 'reconstruction_3d', 'detect_defects', 'results', 'recommendation') THEN
        SELECT extended_status::text INTO NEW.stage FROM public.orders WHERE id = NEW.order_id;
    END IF;
    NEW.sender_name := COALESCE(NEW.sender_name, 'MVCA WoodWorks');
    NEW.sender_role := COALESCE(NEW.sender_role, '');
    NEW.stage := COALESCE(NEW.stage, '');
    RETURN NEW;
END;
$$;
