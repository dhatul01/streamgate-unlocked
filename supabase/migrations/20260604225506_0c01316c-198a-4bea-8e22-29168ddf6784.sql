
CREATE TABLE public.jkt48_setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jkt48_setlists TO anon, authenticated;
GRANT ALL ON public.jkt48_setlists TO service_role;
ALTER TABLE public.jkt48_setlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active setlists" ON public.jkt48_setlists FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage setlists" ON public.jkt48_setlists FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.jkt48_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.jkt48_setlists(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jkt48_songs_setlist_idx ON public.jkt48_songs(setlist_id);
GRANT SELECT ON public.jkt48_songs TO anon, authenticated;
GRANT ALL ON public.jkt48_songs TO service_role;
ALTER TABLE public.jkt48_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active songs" ON public.jkt48_songs FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage songs" ON public.jkt48_songs FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.jkt48_lyrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.jkt48_songs(id) ON DELETE CASCADE,
  content text NOT NULL,
  source_url text DEFAULT '',
  contributor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contributor_name text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jkt48_lyrics_song_idx ON public.jkt48_lyrics(song_id);
CREATE INDEX jkt48_lyrics_status_idx ON public.jkt48_lyrics(status);
GRANT SELECT, INSERT ON public.jkt48_lyrics TO authenticated;
GRANT SELECT ON public.jkt48_lyrics TO anon;
GRANT ALL ON public.jkt48_lyrics TO service_role;
ALTER TABLE public.jkt48_lyrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view approved lyrics" ON public.jkt48_lyrics FOR SELECT USING (status = 'approved');
CREATE POLICY "Users see own submissions" ON public.jkt48_lyrics FOR SELECT USING (auth.uid() IS NOT NULL AND contributor_user_id = auth.uid());
CREATE POLICY "Authenticated can submit lyrics" ON public.jkt48_lyrics FOR INSERT TO authenticated WITH CHECK (auth.uid() = contributor_user_id AND status = 'pending');
CREATE POLICY "Admins manage lyrics" ON public.jkt48_lyrics FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER jkt48_setlists_updated BEFORE UPDATE ON public.jkt48_setlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER jkt48_songs_updated BEFORE UPDATE ON public.jkt48_songs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER jkt48_lyrics_updated BEFORE UPDATE ON public.jkt48_lyrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.jkt48_setlists (name, slug, sort_order) VALUES
  ('Sambil Menggandeng Erat Tanganku', 'tegami', 1),
  ('Pajama Drive', 'pajama-drive', 2),
  ('Cara Meminum Ramuan Sihir', 'ramuan-sihir', 3),
  ('Pajama Drive Passion', 'pajama-drive-passion', 4),
  ('Dream Bakudan', 'dream-bakudan', 5),
  ('Otadaki Love', 'otadaki-love', 6);
