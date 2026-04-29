ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_profile_json jsonb,
ADD COLUMN IF NOT EXISTS user_warnings_json jsonb;