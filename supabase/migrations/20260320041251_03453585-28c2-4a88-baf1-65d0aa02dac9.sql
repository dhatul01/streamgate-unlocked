
-- Fix column order to match actual playlists table: id, stream_id, label, type, url, sort_order, created_at

CREATE OR REPLACE FUNCTION public.get_playlists_for_token(_token_code text)
RETURNS SETOF playlists
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token record;
BEGIN
  SELECT id, status, expires_at INTO _token
  FROM public.tokens
  WHERE code = _token_code;

  IF NOT FOUND OR _token.status = 'blocked' OR _token.expires_at < now() THEN
    RETURN;
  END IF;

  RETURN QUERY 
    SELECT p.id, p.stream_id, p.label, p.type,
      CASE WHEN p.type = 'youtube' THEN 'enc:' || public.obfuscate_url(p.url) ELSE p.url END as url,
      p.sort_order, p.created_at
    FROM public.playlists p
    ORDER BY sort_order;
END;
$$;

-- Fix get_playlists_for_channel too
CREATE OR REPLACE FUNCTION public.get_playlists_for_channel(_moderator_username text)
RETURNS SETOF playlists
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    SELECT p.id, p.stream_id, p.label, p.type,
      CASE WHEN p.type = 'youtube' THEN 'enc:' || public.obfuscate_url(p.url) ELSE p.url END as url,
      p.sort_order, p.created_at
    FROM public.playlists p
    ORDER BY sort_order;
END;
$$;
