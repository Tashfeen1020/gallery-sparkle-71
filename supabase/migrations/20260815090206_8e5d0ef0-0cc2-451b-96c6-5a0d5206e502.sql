CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_name text NOT NULL,
  pin_hash text NOT NULL,
  url text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.photos TO anon, authenticated;
GRANT ALL ON public.photos TO service_role;

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upload photos"
  ON public.photos FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Public view exposes everything except the PIN hash
CREATE VIEW public.photos_public AS
  SELECT id, uploader_name, url, storage_path, file_name, created_at
  FROM public.photos;

GRANT SELECT ON public.photos_public TO anon, authenticated;
GRANT ALL ON public.photos_public TO service_role;

-- Hash the PIN on insert so plaintext is never stored
CREATE OR REPLACE FUNCTION public.hash_photo_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.pin_hash !~ '^\$2[aby]\$' THEN
    NEW.pin_hash := crypt(NEW.pin_hash, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER photos_hash_pin
  BEFORE INSERT ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.hash_photo_pin();

-- PIN-verified delete; returns the storage path of the removed photo
CREATE OR REPLACE FUNCTION public.delete_photo(p_id uuid, p_pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_path text;
BEGIN
  SELECT storage_path INTO v_path
  FROM public.photos
  WHERE id = p_id AND pin_hash = crypt(p_pin, pin_hash);

  IF v_path IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.photos WHERE id = p_id;
  RETURN v_path;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_photo(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_photo(uuid, text) TO anon, authenticated, service_role;