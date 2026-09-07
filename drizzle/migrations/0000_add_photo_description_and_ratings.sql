ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

DROP VIEW IF EXISTS public.photos_public;
CREATE VIEW public.photos_public
WITH (security_invoker = true) AS
SELECT id, uploader_name, storage_path, file_name, category, description, created_at, url
FROM public.photos;

GRANT SELECT ON public.photos_public TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.photo_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  voter_key text NOT NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, voter_key)
);

GRANT SELECT, INSERT, UPDATE ON public.photo_ratings TO anon, authenticated;
GRANT ALL ON public.photo_ratings TO service_role;

ALTER TABLE public.photo_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ratings" ON public.photo_ratings;
CREATE POLICY "Anyone can read ratings" ON public.photo_ratings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can add ratings" ON public.photo_ratings;
CREATE POLICY "Anyone can add ratings" ON public.photo_ratings FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can change own rating" ON public.photo_ratings;
CREATE POLICY "Anyone can change own rating" ON public.photo_ratings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);