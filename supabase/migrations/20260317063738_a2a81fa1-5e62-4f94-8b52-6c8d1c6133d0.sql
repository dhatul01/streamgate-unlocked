
-- Version-control the get_playlists_for_token SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.get_playlists_for_token(_token_code text)
 RETURNS SETOF playlists
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token record;
BEGIN
  SELECT id, status, expires_at INTO _token
  FROM public.tokens
  WHERE code = _token_code;

  IF NOT FOUND OR _token.status = 'blocked' OR _token.expires_at < now() THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.playlists ORDER BY sort_order;
END;
$function$;
