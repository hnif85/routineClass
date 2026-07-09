-- Allow authenticated users to upload to umkmConnect bucket
-- Jalankan di Supabase SQL Editor

CREATE POLICY "Allow authenticated upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'umkmConnect');

-- Allow public read
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'umkmConnect');
