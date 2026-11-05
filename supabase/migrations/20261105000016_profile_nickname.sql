-- A nickname each person can set for themselves in their profile (shown in the top bar instead of the full name).
-- People already edit their own row (policy users_manage_own_profile); the role and active flag stay admin-only
-- (trigger trg_protect_profile_role). Safe to run more than once.

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS nickname TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_nickname_length') THEN
        ALTER TABLE public.user_profiles
            ADD CONSTRAINT user_profiles_nickname_length CHECK (char_length(nickname) <= 30);
    END IF;
END;
$$;
