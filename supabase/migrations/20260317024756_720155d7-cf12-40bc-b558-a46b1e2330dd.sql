
-- Create storage bucket for moderator logos
INSERT INTO storage.buckets (id, name, public) VALUES ('moderator-logos', 'moderator-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow moderators to upload their own logo
CREATE POLICY "Moderators can upload own logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'moderator-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.moderators WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Moderators can update own logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'moderator-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.moderators WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Moderators can delete own logo" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'moderator-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.moderators WHERE user_id = auth.uid()
    )
  );

-- Public can read moderator logos
CREATE POLICY "Public can read moderator logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'moderator-logos');
