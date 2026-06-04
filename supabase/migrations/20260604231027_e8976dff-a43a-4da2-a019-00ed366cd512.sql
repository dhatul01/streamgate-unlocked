ALTER TABLE public.jkt48_lyrics ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.jkt48_lyrics ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.jkt48_lyrics ADD COLUMN IF NOT EXISTS is_link_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.jkt48_lyrics ADD COLUMN IF NOT EXISTS external_title text DEFAULT '';
-- Allow link-only submissions (no content) by users
DROP POLICY IF EXISTS "Authenticated can submit lyrics" ON public.jkt48_lyrics;
CREATE POLICY "Authenticated can submit lyrics" ON public.jkt48_lyrics
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = contributor_user_id AND status = 'pending');