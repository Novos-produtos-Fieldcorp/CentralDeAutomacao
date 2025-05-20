-- Update the bucket configuration to allow PDF files
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 
  'image/png', 
  'image/jpg', 
  'application/pdf'
]::text[],
file_size_limit = 15728640 -- 15MB
WHERE id = 'imagensdocs';

-- Make sure the bucket is public
UPDATE storage.buckets
SET public = true
WHERE id = 'imagensdocs';

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