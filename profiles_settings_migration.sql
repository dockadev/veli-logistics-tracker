-- Migration Script: Profiles Table Settings Persistence
-- Run this SQL in your Supabase Dashboard SQL Editor to update the schema

-- 1. Add settings columns to public.profiles if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clan TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_seen BOOLEAN DEFAULT false;

-- 2. Ensure RLS is enabled on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create/update update policy for users on their own profiles
DROP POLICY IF EXISTS "Allow users to update their own settings" ON public.profiles;
CREATE POLICY "Allow users to update their own settings"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Create trigger to prevent standard users from self-updating role or status
CREATE OR REPLACE FUNCTION public.check_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if role or status is being changed
    IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
        -- Only allow if the requester is a developer
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'developer'
        ) THEN
            RAISE EXCEPTION 'Only developers can update user roles or statuses.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplicate error
DROP TRIGGER IF EXISTS enforce_profile_update_rules ON public.profiles;

CREATE TRIGGER enforce_profile_update_rules
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_profile_updates();
