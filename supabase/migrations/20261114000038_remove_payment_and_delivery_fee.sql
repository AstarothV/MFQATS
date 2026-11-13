-- Payment method, pick-up or delivery, and the delivery fee are left for a future version (Chapter 6, recommendation 8).
-- This takes out what migration 037 added for them: the shop settings (rates, pick-up address, GCash and bank
-- details), the order columns and rules for the fee and the payment, the preferred payment method, and the map
-- positions of saved addresses. Kept from 037: saved delivery addresses (customer_addresses) and the two-step sign-in
-- code by email. Orders keep their delivery address, city and phone as before.
-- payment_status and pickup_type were already in the live table before 037 but never used by the system; they go too.
-- Safe to run more than once, and also on a database where 037 was never run.

DROP TRIGGER IF EXISTS trg_notify_payment_and_fee ON public.orders;
DROP TRIGGER IF EXISTS trg_order_delivery_and_payment ON public.orders;
DROP FUNCTION IF EXISTS public.notify_payment_and_fee();
DROP FUNCTION IF EXISTS public.order_delivery_and_payment();
DROP FUNCTION IF EXISTS public.delivery_fee_for(NUMERIC);
DROP FUNCTION IF EXISTS public.km_between(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP TABLE IF EXISTS public.shop_settings;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_pickup_type;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status;
ALTER TABLE public.orders
    DROP COLUMN IF EXISTS pickup_type,
    DROP COLUMN IF EXISTS delivery_lat,
    DROP COLUMN IF EXISTS delivery_lng,
    DROP COLUMN IF EXISTS delivery_km,
    DROP COLUMN IF EXISTS delivery_fee,
    DROP COLUMN IF EXISTS payment_method,
    DROP COLUMN IF EXISTS payment_reference,
    DROP COLUMN IF EXISTS payment_status,
    DROP COLUMN IF EXISTS paid_at;

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_preferred_payment;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS preferred_payment;

ALTER TABLE IF EXISTS public.customer_addresses DROP COLUMN IF EXISTS lat, DROP COLUMN IF EXISTS lng;
