-- Audit logs that fill themselves. Before this, nothing wrote to audit_logs (only 3 seed rows), and its access rule
-- only let admins write, so staff and customer activity could not be recorded at all.
--   1. log_activity(): the website records sign-ins, sign-outs, opening the system and password changes, for the
--      signed-in person (with their IP address and browser).
--   2. audit_row_change(): the database itself records every change to orders, products, users, inventory, defect
--      scans, defects and rework, with who did it and what changed (old and new values).
-- Recording never blocks the real action: if writing the log fails, the change still goes through.
-- Safe to run again.

CREATE OR REPLACE FUNCTION public.log_activity(p_action TEXT, p_entity_type TEXT DEFAULT 'auth', p_details JSONB DEFAULT '{}')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    h JSON := nullif(current_setting('request.headers', true), '')::JSON;
BEGIN
    -- the website may only record these; data changes are recorded by the triggers below
    IF auth.uid() IS NULL OR p_action NOT IN ('user_login', 'user_logout', 'system_access', 'password_changed') THEN
        RETURN;
    END IF;
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
    SELECT auth.uid(), p_action, p_entity_type, auth.uid(), coalesce(p_details, '{}'),
           coalesce(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''), coalesce(h->>'user-agent', '')
    WHERE EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.log_activity(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity(TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    h JSON := nullif(current_setting('request.headers', true), '')::JSON;
    -- columns that change on their own or hold photos and long data: kept out of the log
    skip TEXT[] := ARRAY['updated_at', 'last_updated', 'image_url', 'images', 'detections', 'specifications', 'avatar_url', 'completion_pct'];
    old_j JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    new_j JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    changed_new JSONB := '{}';
    changed_old JSONB := '{}';
    verb TEXT := CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END;
    act TEXT;
    who UUID := auth.uid();
BEGIN
    IF TG_OP = 'UPDATE' THEN
        SELECT coalesce(jsonb_object_agg(key, value), '{}') INTO changed_new
        FROM jsonb_each(new_j) WHERE NOT key = ANY (skip) AND old_j->key IS DISTINCT FROM value;
        IF changed_new = '{}' THEN RETURN NULL; END IF; -- only skipped columns changed
        SELECT coalesce(jsonb_object_agg(key, old_j->key), '{}') INTO changed_old FROM jsonb_object_keys(changed_new) AS key;
    END IF;

    act := CASE TG_TABLE_NAME
        WHEN 'orders' THEN CASE
            WHEN TG_OP = 'INSERT' THEN 'order_placed'
            WHEN TG_OP = 'DELETE' THEN 'order_deleted'
            WHEN changed_new ? 'extended_status' THEN 'stage_update'
            WHEN changed_new ? 'assigned_to' THEN 'staff_assigned'
            ELSE 'order_updated' END
        WHEN 'detection_logs' THEN 'qa_submitted'
        WHEN 'defects' THEN CASE WHEN TG_OP = 'INSERT' THEN 'defect_reported' ELSE 'defect_' || verb END
        WHEN 'rework_logs' THEN 'rework_' || verb
        WHEN 'products' THEN 'product_' || verb
        WHEN 'user_profiles' THEN 'user_' || verb
        WHEN 'inventory' THEN 'inventory_' || verb
        ELSE TG_TABLE_NAME || '_' || verb END;

    IF who IS NULL AND TG_TABLE_NAME = 'user_profiles' AND TG_OP = 'INSERT' THEN
        who := NEW.id; -- a new account signing itself up
    END IF;

    BEGIN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
        VALUES (
            CASE WHEN EXISTS (SELECT 1 FROM public.user_profiles WHERE id = who) THEN who END,
            act, TG_TABLE_NAME, (coalesce(new_j, old_j)->>'id')::UUID,
            CASE TG_OP WHEN 'UPDATE' THEN changed_old WHEN 'DELETE' THEN old_j - skip ELSE '{}' END,
            CASE TG_OP WHEN 'UPDATE' THEN changed_new WHEN 'INSERT' THEN new_j - skip ELSE '{}' END,
            coalesce(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''), coalesce(h->>'user-agent', '')
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'audit log not written for % on %: %', TG_OP, TG_TABLE_NAME, SQLERRM;
    END;
    RETURN NULL;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['orders', 'products', 'user_profiles', 'inventory', 'defects', 'rework_logs'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
    END LOOP;
    DROP TRIGGER IF EXISTS trg_audit_detection_logs ON public.detection_logs;
    CREATE TRIGGER trg_audit_detection_logs AFTER INSERT ON public.detection_logs
        FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
END $$;
