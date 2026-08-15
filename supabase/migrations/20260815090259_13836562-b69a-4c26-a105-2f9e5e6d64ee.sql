CREATE POLICY "Anyone can upload gallery photos"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can read gallery photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'photos');

CREATE POLICY "Anyone can delete gallery photos"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'photos');