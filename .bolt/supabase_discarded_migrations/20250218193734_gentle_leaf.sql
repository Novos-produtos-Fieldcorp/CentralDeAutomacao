/*
  # Add storage policies for checklist photos

  1. Creates policies for the checklist-photos bucket
  2. Allows authenticated users to manage their photos
*/

-- Enable storage by creating the extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "storage";

-- Create policy to allow authenticated users to upload photos
INSERT INTO storage.buckets (id, name)
VALUES ('checklist-photos', 'checklist-photos')
ON CONFLICT DO NOTHING;

-- Create policies
CREATE POLICY "Authenticated users can upload checklist photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can read checklist photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update their checklist photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete their checklist photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);