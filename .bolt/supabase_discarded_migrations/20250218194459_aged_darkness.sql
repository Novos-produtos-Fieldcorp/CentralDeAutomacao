/*
  # Fix Storage Bucket Configuration

  1. Changes
    - Ensure storage extension is enabled
    - Create storage bucket for checklist photos
    - Set up proper RLS policies for bucket access
    
  2. Security
    - Only authenticated users can access the bucket
    - Policies for insert, select, update and delete operations
*/

-- Enable storage extension
CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA extensions;

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for checklist photos bucket
CREATE POLICY "Allow authenticated users to upload checklist photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to view checklist photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update checklist photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to delete checklist photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);