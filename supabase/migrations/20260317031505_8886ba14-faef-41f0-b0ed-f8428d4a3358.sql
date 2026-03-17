
-- Create a function for moderators to create tokens atomically
CREATE OR REPLACE FUNCTION public.moderator_create_token(
  _code text,
  _duration_type text,
  _expires_at timestamptz,
  _max_devices int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _moderator record;
  _token record;
BEGIN
  -- Verify caller is an active moderator
  SELECT id, username INTO _moderator
  FROM public.moderators
  WHERE user_id = auth.uid() AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bukan moderator aktif');
  END IF;

  -- Insert token
  INSERT INTO public.tokens (code, duration_type, expires_at, max_devices, status)
  VALUES (_code, _duration_type, _expires_at, _max_devices, 'active')
  RETURNING * INTO _token;

  -- Log the creation
  INSERT INTO public.moderator_token_logs (moderator_id, token_id)
  VALUES (_moderator.id, _token.id);

  RETURN json_build_object(
    'success', true,
    'id', _token.id,
    'code', _token.code
  );
END;
$function$;
