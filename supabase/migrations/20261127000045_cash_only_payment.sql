-- 045: cash only (panel revision, 2026-11-27). No online payment: the down payment is paid in cash at the store and
-- the balance by cash on delivery (delivery) or at the store on pick-up. Removes what only online payment used:
-- the GCash and bank details in shop_settings, the payment reference on orders and the function that saved it.
-- Run by hand in the Supabase SQL editor after 044.

-- orders that chose online payment pay the balance in cash instead
UPDATE public.orders
   SET payment_method = CASE WHEN pickup_type = 'delivery' THEN 'cod' ELSE 'store' END
 WHERE payment_method = 'online';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method
    CHECK (payment_method IS NULL OR payment_method IN ('cod', 'store'));

DROP FUNCTION IF EXISTS public.submit_payment_reference(UUID, TEXT);
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_reference;

ALTER TABLE public.shop_settings
    DROP COLUMN IF EXISTS gcash_name,
    DROP COLUMN IF EXISTS gcash_number,
    DROP COLUMN IF EXISTS bank_details;
