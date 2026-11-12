-- The AR preview was removed from the shop (PR #18); nothing reads or writes this column any more.
ALTER TABLE public.products DROP COLUMN IF EXISTS ar_model_support;
