-- Email the customer every notification they get about their order (placed, approved, each stage, cancellation
-- decision, delivered...). Chat message notifications are not emailed.
-- How: after a notification is saved, the database asks the website (/api/order-email) to send it through Gmail.
-- pg_net sends the request after the change is committed, so an undone change never sends an email, and a failed
-- email never blocks an order.
--
-- After running this, add the website address and the shared secret ONCE (also set ORDER_EMAIL_SECRET on Vercel):
--   INSERT INTO private.email_settings (url, secret)
--   VALUES ('https://mfqats-tau.vercel.app/api/order-email', '<the same secret as ORDER_EMAIL_SECRET>')
--   ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, secret = EXCLUDED.secret;
-- Until that row exists, nothing is emailed. Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS private.email_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    url TEXT NOT NULL,
    secret TEXT NOT NULL
);
REVOKE ALL ON private.email_settings FROM PUBLIC;
ALTER TABLE private.email_settings ENABLE ROW LEVEL SECURITY;  -- no policies: only the database itself reads it

CREATE OR REPLACE FUNCTION public.email_customer_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    s private.email_settings;
    u public.user_profiles;
    ref TEXT;
BEGIN
    IF NEW.entity_id IS NULL OR COALESCE(NEW.entity_type, '') NOT IN ('orders', 'order') OR NEW.title ~* 'message' THEN
        RETURN NEW;
    END IF;
    SELECT * INTO u FROM public.user_profiles WHERE id = NEW.user_id;
    IF NOT FOUND OR u.role::TEXT <> 'customer' OR COALESCE(u.email, '') = '' THEN
        RETURN NEW;
    END IF;
    SELECT * INTO s FROM private.email_settings WHERE id = 1;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    SELECT order_ref INTO ref FROM public.orders WHERE id = NEW.entity_id;
    PERFORM net.http_post(
        url := s.url,
        body := jsonb_build_object('to', u.email, 'name', u.full_name, 'title', NEW.title, 'message', NEW.message,
                                   'order_ref', ref, 'order_id', NEW.entity_id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', s.secret),
        timeout_milliseconds := 10000
    );
    RETURN NEW;
EXCEPTION WHEN others THEN
    RAISE WARNING 'Order email not sent: %', SQLERRM;  -- an email problem must never stop the order
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_customer_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_customer_notification ON public.notifications;
CREATE TRIGGER trg_email_customer_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.email_customer_notification();
