
-- Add is_public column to tokens
ALTER TABLE public.tokens ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Update validate_token to include is_public
CREATE OR REPLACE FUNCTION public.validate_token(_code text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Update create_token_session to skip device limit for public tokens
CREATE OR REPLACE FUNCTION public.create_token_session(_token_code text, _fingerprint text, _user_agent text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token record;
  _existing record;
  _session_count int;
  _new_session record;
BEGIN
  SELECT id, max_devices, status, expires_at, is_public INTO _token
  FROM public.tokens WHERE code = _token_code;

  IF NOT FOUND OR _token.status = 'blocked' OR _token.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Token tidak valid');
  END IF;

  -- For public tokens, skip device limit entirely
  IF _token.is_public THEN
    -- Check if fingerprint already has session
    SELECT id INTO _existing
    FROM public.token_sessions
    WHERE token_id = _token.id AND fingerprint = _fingerprint;

    IF FOUND THEN
      RETURN json_build_object('success', true, 'session_id', _existing.id);
    END IF;

    INSERT INTO public.token_sessions (token_id, fingerprint, user_agent)
    VALUES (_token.id, _fingerprint, _user_agent)
    RETURNING * INTO _new_session;

    RETURN json_build_object('success', true, 'session_id', _new_session.id);
  END IF;

  -- Private token: check existing session
  SELECT id INTO _existing
  FROM public.token_sessions
  WHERE token_id = _token.id AND fingerprint = _fingerprint;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'session_id', _existing.id);
  END IF;

  -- Check device limit
  SELECT count(*) INTO _session_count
  FROM public.token_sessions WHERE token_id = _token.id;

  IF _session_count >= _token.max_devices THEN
    RETURN json_build_object('success', false, 'error', 'Batas perangkat tercapai');
  END IF;

  INSERT INTO public.token_sessions (token_id, fingerprint, user_agent)
  VALUES (_token.id, _fingerprint, _user_agent)
  RETURNING * INTO _new_session;

  RETURN json_build_object('success', true, 'session_id', _new_session.id);
END;
$$;
