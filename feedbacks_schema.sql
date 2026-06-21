-- Run this SQL in your Supabase Dashboard SQL Editor to create the feedbacks table, grant permissions, and set up policies

CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'idea' NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- If you have an existing feedbacks table, run these SQL statements to update the schema:
-- ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'idea' NOT NULL;
-- ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' NOT NULL;

-- Grant privileges to standard roles
GRANT ALL ON public.feedbacks TO anon, authenticated, service_role;

-- Enable Row Level Security (RLS)
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Policy to allow anonymous/authenticated users to submit feedbacks
CREATE POLICY "Allow insert for all users" 
ON public.feedbacks 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Policy to allow developers to view feedbacks
CREATE POLICY "Allow select for all users" 
ON public.feedbacks 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- Policy to allow developers to delete feedbacks
CREATE POLICY "Allow delete for all users" 
ON public.feedbacks 
FOR DELETE 
TO anon, authenticated 
USING (true);
