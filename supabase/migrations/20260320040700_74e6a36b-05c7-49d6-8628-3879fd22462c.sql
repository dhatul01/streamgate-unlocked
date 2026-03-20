
-- Create XOR-based URL obfuscation function for YouTube URLs
-- Uses pure SQL byte operations to avoid UTF-8 encoding issues
CREATE OR REPLACE FUNCTION public.obfuscate_url(_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT encode(
    (SELECT string_agg(
      set_byte(decode('00', 'hex'), 0,
        get_byte(convert_to(_url, 'UTF8'), i) # get_byte(convert_to('RT48xK9mQ2vL7nP4', 'UTF8'), i % 16)
      )::bytea, ''::bytea
    )
    FROM generate_series(0, octet_length(convert_to(_url, 'UTF8')) - 1) AS i),
    'base64'
  );
$$;

-- Update get_playlists_for_token to encrypt YouTube URLs
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
    SELECT p.id, p.created_at, p.label, p.sort_order, p.stream_id,
      p.type,
      CASE WHEN p.type = 'youtube' THEN 'enc:' || public.obfuscate_url(p.url) ELSE p.url END as url
    FROM public.playlists p
    ORDER BY sort_order;
END;
$$;

-- Update get_playlists_for_channel to encrypt YouTube URLs
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
    SELECT p.id, p.created_at, p.label, p.sort_order, p.stream_id,
      p.type,
      CASE WHEN p.type = 'youtube' THEN 'enc:' || public.obfuscate_url(p.url) ELSE p.url END as url
    FROM public.playlists p
    ORDER BY sort_order;
END;
$$;
