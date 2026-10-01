ALTER TABLE public.photos ALTER COLUMN pin_hash SET DEFAULT 'admin-only';

CREATE TABLE public.site_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.site_settings (id, data) VALUES (1, '{}'::jsonb) ON CONFLICT DO NOTHING;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;