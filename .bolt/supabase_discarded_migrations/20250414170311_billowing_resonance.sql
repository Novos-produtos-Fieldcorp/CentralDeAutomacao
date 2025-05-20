/*
  # Add storage bucket for documents

  1. Changes
    - Create a new storage bucket for driver documents
    - Set up proper RLS policies for bucket access
    
  2. Security
    - Only authenticated users can access the bucket
    - Policies for insert, select, update and delete operations
*/

-- Enable storage extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA extensions;

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for documents bucket
CREATE POLICY "Allow authenticated users to upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to view documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);