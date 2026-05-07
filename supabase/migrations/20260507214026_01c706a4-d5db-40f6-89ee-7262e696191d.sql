CREATE TABLE public.members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  photo_url text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX members_name_lower_idx ON public.members (lower(name));

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read members" ON public.members FOR SELECT USING (true);

CREATE POLICY "Admins can manage members" ON public.members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can manage members" ON public.members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.moderators WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.moderators WHERE user_id = auth.uid() AND is_active = true));

CREATE TRIGGER members_updated_at BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public storage bucket for member photos
INSERT INTO storage.buckets (id, name, public) VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Member photos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'member-photos');

CREATE POLICY "Admins can upload member photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'member-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update member photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'member-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete member photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'member-photos' AND public.has_role(auth.uid(), 'admin'));