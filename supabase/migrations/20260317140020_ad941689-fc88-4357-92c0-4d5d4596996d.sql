
-- Fix validate_token: remove per-token-code rate limit that blocks shared public tokens
-- Instead, keep rate limiting at the edge function level where we have IP info
CREATE OR REPLACE FUNCTION public.validate_token(_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _token record;
BEGIN
  SELECT id, code, max_devices, duration_type, expires_at, status, is_public
  INTO _token
  FROM public.tokens
  WHERE code = _code;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Token tidak valid');
  END IF;

  IF _token.status = 'blocked' THEN
    RETURN json_build_object('valid', false, 'error', 'Token telah diblokir');
  END IF;

  IF _token.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'Token telah expired');
  END IF;

  RETURN json_build_object(
    'valid', true,
    'id', _token.id,
    'code', _token.code,
    'max_devices', _token.max_devices,
    'expires_at', _token.expires_at,
    'status', _token.status,
    'is_public', _token.is_public
  );
END;
$function$;
