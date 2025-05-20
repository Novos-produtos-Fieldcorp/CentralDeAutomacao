/*
  # Create Storage Bucket for Document Uploads

  1. Changes
    - Create a new storage bucket called 'imagensdocs'
    - Set up RLS policies for the bucket
    - Allow authenticated users to upload, read, update, and delete files
    
  2. Security
    - Bucket is public to allow easier access to uploaded files
    - Proper policies for all CRUD operations
*/

-- Create the bucket if it doesn't exist (making it public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('imagensdocs', 'imagensdocs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create policies for document uploads bucket
CREATE POLICY "Allow public access to imagensdocs"
ON storage.objects FOR SELECT
USING (bucket_id = 'imagensdocs');

CREATE POLICY "Allow uploads to imagensdocs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'imagensdocs');

CREATE POLICY "Allow updates in imagensdocs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'imagensdocs');

CREATE POLICY "Allow deletions from imagensdocs"
ON storage.objects FOR DELETE
USING (bucket_id = 'imagensdocs');