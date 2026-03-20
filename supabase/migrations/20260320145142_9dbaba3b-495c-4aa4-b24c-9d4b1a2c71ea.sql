
-- Watch parties table
CREATE TABLE public.watch_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL UNIQUE,
  host_username text NOT NULL,
  host_token_code text,
  is_active boolean NOT NULL DEFAULT true,
  playlist_index integer DEFAULT 0,
  playback_position real DEFAULT 0,
  is_playing boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Watch party members
CREATE TABLE public.watch_party_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  username text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(party_id, username)
);

-- RLS
ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_party_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active parties" ON public.watch_parties FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Anyone can create parties" ON public.watch_parties FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update parties" ON public.watch_parties FOR UPDATE TO public USING (true);
CREATE POLICY "Admins can manage parties" ON public.watch_parties FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read members" ON public.watch_party_members FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can join" ON public.watch_party_members FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can leave" ON public.watch_party_members FOR DELETE TO public USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_members;

-- Auto update
CREATE TRIGGER update_watch_parties_updated_at
  BEFORE UPDATE ON public.watch_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
