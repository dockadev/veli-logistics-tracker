-- Migration Script: Analytics Leaderboard & Depot History
-- Run this SQL in your Supabase Dashboard SQL Editor to update the database schema and RLS policies

-- 1. Add tracking columns to public.profiles if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS import_count INT DEFAULT 0 NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS request_count INT DEFAULT 0 NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delivery_count INT DEFAULT 0 NOT NULL;

-- 2. Create the depots_history table for 7-day trend tracking
CREATE TABLE IF NOT EXISTS public.depots_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    depot_name TEXT NOT NULL,
    items JSONB NOT NULL,
    imported_by UUID REFERENCES auth.users(id),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Grant privileges on history table
GRANT ALL ON public.depots_history TO anon, authenticated, service_role;

-- 3. Enable Row Level Security (RLS) on depots_history
ALTER TABLE public.depots_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select depots_history for approved members" ON public.depots_history;
DROP POLICY IF EXISTS "Allow insert depots_history for approved members" ON public.depots_history;
DROP POLICY IF EXISTS "Allow delete depots_history for approved members" ON public.depots_history;

-- Only approved users can view history
CREATE POLICY "Allow select depots_history for approved members"
ON public.depots_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status = 'approved'
    )
);

-- Only approved users can add to history
CREATE POLICY "Allow insert depots_history for approved members"
ON public.depots_history
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status = 'approved'
    )
);

-- Only approved users can delete history (for 7-day cleanup)
CREATE POLICY "Allow delete depots_history for approved members"
ON public.depots_history
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status = 'approved'
    )
);

-- 4. Secure RPC Function: Increment stats securely from the client side
CREATE OR REPLACE FUNCTION public.increment_profile_stat(stat_type TEXT)
RETURNS VOID AS $$
BEGIN
    -- Only allow if requester is approved
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Only approved members can log statistics.';
    END IF;

    IF stat_type = 'import' THEN
        UPDATE public.profiles SET import_count = import_count + 1 WHERE id = auth.uid();
    ELSIF stat_type = 'request' THEN
        UPDATE public.profiles SET request_count = request_count + 1 WHERE id = auth.uid();
    ELSIF stat_type = 'delivery' THEN
        UPDATE public.profiles SET delivery_count = delivery_count + 1 WHERE id = auth.uid();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Secure RPC Function: Reset all klan leaderboard stats for a new war
-- Only officers or developers can invoke this reset
CREATE OR REPLACE FUNCTION public.reset_leaderboard_stats()
RETURNS VOID AS $$
BEGIN
    -- Check if requester is authenticated and has developer role
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'developer'
    ) THEN
        RAISE EXCEPTION 'Only developers can reset leaderboard statistics.';
    END IF;

    -- Reset all profiles' leaderboard counters
    UPDATE public.profiles
    SET import_count = 0,
        request_count = 0,
        delivery_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
