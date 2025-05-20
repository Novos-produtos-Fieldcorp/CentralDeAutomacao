/*
  # Fix Storage Policies for Document Uploads

  1. Changes
    - Drop existing policies that might be causing conflicts
    - Create new policies with proper authentication checks
    - Make bucket public to allow easier access to uploaded files
    
  2. Security
    - Still requires authentication for uploads and modifications
    - Allows public read access for convenience
*/

-- Enable storage extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA extensions;

-- Create the bucket if it doesn't exist (making it public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('imagensdocs', 'imagensdocs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON storage.objects;

-- Create new policies with simpler conditions
CREATE POLICY "Allow public access to imagensdocs"
ON storage.objects FOR SELECT
USING (bucket_id = 'imagensdocs');

CREATE POLICY "Allow authenticated users to upload to imagensdocs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'imagensdocs' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update in imagensdocs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'imagensdocs' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete from imagensdocs"
ON storage.objects FOR DELETE
USING (bucket_id = 'imagensdocs' AND auth.role() = 'authenticated');