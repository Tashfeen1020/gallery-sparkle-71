ALTER VIEW public.photos_public SET (security_invoker = true);

GRANT SELECT (id, uploader_name, url, storage_path, file_name, created_at)
  ON public.photos TO anon, authenticated;

CREATE POLICY "Anyone can view photos"
  ON public.photos FOR SELECT TO anon, authenticated
  USING (true);