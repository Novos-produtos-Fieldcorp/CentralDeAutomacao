/*
  # Create Storage Bucket for Document Uploads with PDF Support

  1. Changes
    - Create a new storage bucket called 'imagensdocs'
    - Set up RLS policies for the bucket
    - Allow public access to files
    - Configure for PDF support
    
  2. Security
    - Bucket is public for easier access
    - Open policies to allow uploads without authentication
*/

-- Create the bucket if it doesn't exist (making it public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imagensdocs', 
  'imagensdocs', 
  true, 
  15728640, -- 15MB limit
  ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/jpg', 
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/jpg', 
    'application/pdf'
  ]::text[];

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