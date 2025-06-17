-- Create the checklist-photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-photos',
  'checklist-photos',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload checklist photos
CREATE POLICY "Allow authenticated users to upload checklist photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'checklist-photos');

-- Policy to allow public read access to checklist photos
CREATE POLICY "Allow public read access to checklist photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'checklist-photos');

-- Policy to allow authenticated users to update their uploaded photos
CREATE POLICY "Allow authenticated users to update checklist photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'checklist-photos');

-- Policy to allow authenticated users to delete checklist photos
CREATE POLICY "Allow authenticated users to delete checklist photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'checklist-photos');