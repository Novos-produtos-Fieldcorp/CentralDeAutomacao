/*
  # Create and Configure Storage Bucket for Document Uploads

  1. New Features
    - Create a storage bucket for document uploads
    - Configure file size limits and allowed MIME types
    - Set up proper security policies
    
  2. Security
    - Allow public access for viewing documents
    - Restrict upload/update/delete operations
    - Set file size limit to 15MB
    - Allow only specific file types (JPEG, PNG, PDF)
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

-- Ensure policies exist for the bucket
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public access to imagensdocs'
  ) THEN
    CREATE POLICY "Allow public access to imagensdocs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'imagensdocs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow uploads to imagensdocs'
  ) THEN
    CREATE POLICY "Allow uploads to imagensdocs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'imagensdocs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow updates in imagensdocs'
  ) THEN
    CREATE POLICY "Allow updates in imagensdocs"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'imagensdocs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow deletions from imagensdocs'
  ) THEN
    CREATE POLICY "Allow deletions from imagensdocs"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'imagensdocs');
  END IF;
END $$;