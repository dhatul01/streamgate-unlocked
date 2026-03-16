
-- Shows table for landing page cards
CREATE TABLE public.shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  price text NOT NULL DEFAULT '',
  lineup text NOT NULL DEFAULT '',
  schedule_date text NOT NULL DEFAULT '',
  schedule_time text NOT NULL DEFAULT '',
  background_image_url text,
  qris_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage shows" ON public.shows
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read active shows" ON public.shows
  FOR SELECT TO public
  USING (is_active = true);

-- Site settings table (key-value)
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage site settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read site settings" ON public.site_settings
  FOR SELECT TO public
  USING (true);

-- Insert default settings
INSERT INTO public.site_settings (key, value) VALUES
  ('whatsapp_number', ''),
  ('purchase_message', 'Untuk pembelian token streaming, silakan hubungi kami via WhatsApp.'),
  ('site_title', 'RealTime48 Streaming');

-- Storage bucket for show images
INSERT INTO storage.buckets (id, name, public) VALUES ('show-images', 'show-images', true);

-- Storage policies
CREATE POLICY "Admins can upload show images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'show-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete show images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'show-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view show images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'show-images');
