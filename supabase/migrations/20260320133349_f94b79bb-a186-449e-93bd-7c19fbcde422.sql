CREATE OR REPLACE FUNCTION public.validate_token(_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token record;
  _show_start timestamptz;
  _show_title text;
BEGIN
  SELECT t.id, t.code, t.max_devices, t.duration_type, t.expires_at, t.status, t.is_public, t.show_id
  INTO _token FROM public.tokens t WHERE t.code = _code;

  IF NOT FOUND THEN RETURN json_build_object('valid', false, 'error', 'Token tidak valid'); END IF;
  IF _token.status = 'blocked' THEN RETURN json_build_object('valid', false, 'error', 'Token telah diblokir'); END IF;
  IF _token.expires_at < now() THEN RETURN json_build_object('valid', false, 'error', 'Token telah expired'); END IF;

  -- Show-linked token: check time window but still return valid=true
  IF _token.show_id IS NOT NULL THEN
    SELECT public.parse_show_datetime(s.schedule_date, s.schedule_time), s.title
    INTO _show_start, _show_title
    FROM public.shows s WHERE s.id = _token.show_id;

    IF _show_start IS NOT NULL AND now() < (_show_start - interval '30 minutes') THEN
      RETURN json_build_object('valid', true, 'id', _token.id, 'code', _token.code,
        'max_devices', _token.max_devices, 'expires_at', _token.expires_at,
        'status', _token.status, 'is_public', _token.is_public, 'show_id', _token.show_id,
        'access_not_yet', true, 'show_start', _show_start, 'show_title', _show_title);
    END IF;
  END IF;

  RETURN json_build_object(
    'valid', true, 'id', _token.id, 'code', _token.code,
    'max_devices', _token.max_devices, 'expires_at', _token.expires_at,
    'status', _token.status, 'is_public', _token.is_public, 'show_id', _token.show_id
  );
END;
$function$;