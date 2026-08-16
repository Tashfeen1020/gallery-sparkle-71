ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other';

DROP VIEW IF EXISTS public.photos_public;

CREATE VIEW public.photos_public
WITH (security_invoker = true) AS
SELECT id, uploader_name, storage_path, file_name, url, category, created_at
FROM public.photos;

GRANT SELECT ON public.photos_public TO anon, authenticated;
GRANT ALL ON public.photos_public TO service_role;