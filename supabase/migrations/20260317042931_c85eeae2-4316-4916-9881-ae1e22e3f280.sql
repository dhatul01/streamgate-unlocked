-- Create moderator_playlists table for moderator-specific video sources
CREATE TABLE public.moderator_playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moderator_id UUID NOT NULL REFERENCES public.moderators(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'm3u8',
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.moderator_playlists ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage moderator playlists"
  ON public.moderator_playlists FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Moderators can manage own playlists
CREATE POLICY "Moderators can manage own playlists"
  ON public.moderator_playlists FOR ALL
  TO authenticated
  USING (moderator_id IN (SELECT id FROM public.moderators WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (moderator_id IN (SELECT id FROM public.moderators WHERE user_id = auth.uid() AND is_active = true));

-- Public can read active moderator playlists (for channel pages)
CREATE POLICY "Public can read moderator playlists"
  ON public.moderator_playlists FOR SELECT
  TO anon
  USING (moderator_id IN (SELECT id FROM public.moderators WHERE is_active = true));

-- Create RPC to get moderator playlists for channel page
CREATE OR REPLACE FUNCTION public.get_moderator_playlists(_moderator_username text)
RETURNS SETOF public.moderator_playlists
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.moderators
    WHERE username = _moderator_username AND is_active = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT mp.* FROM public.moderator_playlists mp
    JOIN public.moderators m ON mp.moderator_id = m.id
    WHERE m.username = _moderator_username AND m.is_active = true
    ORDER BY mp.sort_order;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.moderator_playlists;