CREATE OR REPLACE FUNCTION public.moderator_create_token(
  _code text,
  _duration_type text,
  _expires_at timestamptz,
  _max_devices integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _moderator record;
  _token record;
  _normalized_duration text;
BEGIN
  SELECT id, username INTO _moderator
  FROM public.moderators
  WHERE user_id = auth.uid() AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bukan moderator aktif');
  END IF;

  _normalized_duration := CASE lower(trim(_duration_type))
    WHEN 'harian' THEN 'daily'
    WHEN 'mingguan' THEN 'weekly'
    WHEN 'bulanan' THEN 'monthly'
    WHEN 'daily' THEN 'daily'
    WHEN 'weekly' THEN 'weekly'
    WHEN 'monthly' THEN 'monthly'
    ELSE NULL
  END;

  IF _normalized_duration IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Durasi token tidak valid');
  END IF;

  INSERT INTO public.tokens (code, duration_type, expires_at, max_devices, status, is_public)
  VALUES (
    _code,
    _normalized_duration,
    _expires_at,
    GREATEST(COALESCE(_max_devices, 1), 1),
    'active',
    false
  )
  RETURNING * INTO _token;

  INSERT INTO public.moderator_token_logs (moderator_id, token_id)
  VALUES (_moderator.id, _token.id);

  RETURN json_build_object(
    'success', true,
    'id', _token.id,
    'code', _token.code,
    'duration_type', _token.duration_type
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.moderator_create_token(text, text, timestamptz, integer) TO authenticated;