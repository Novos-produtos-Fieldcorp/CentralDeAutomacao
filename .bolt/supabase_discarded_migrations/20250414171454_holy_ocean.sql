/*
  # Fix Documents Storage Bucket

  1. Changes
    - Ensure storage extension is enabled
    - Create documents bucket with proper settings
    - Set up RLS policies for document access
    
  2. Security
    - Only authenticated users can access documents
    - Policies for insert, select, update and delete operations
*/

-- Enable storage extension
CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA extensions;

-- Create the documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON storage.objects;

-- Create policies for documents bucket
CREATE POLICY "Allow authenticated users to upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
);

CREATE POLICY "Allow authenticated users to view documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
);

CREATE POLICY "Allow authenticated users to update documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
)
WITH CHECK (
  bucket_id = 'documents'
);

CREATE POLICY "Allow authenticated users to delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
);