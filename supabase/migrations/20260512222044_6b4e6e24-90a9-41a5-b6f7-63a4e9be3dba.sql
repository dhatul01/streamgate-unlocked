
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS locked_fingerprint text;

CREATE OR REPLACE FUNCTION public.create_token_session(_token_code text, _fingerprint text, _user_agent text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token record;
  _existing record;
  _session_count int;
  _new_session record;
  _allowed boolean;
BEGIN
  SELECT public.check_rate_limit('cs:' || _fingerprint, 5, 60) INTO _allowed;
  IF NOT _allowed THEN
    RETURN json_build_object('success', false, 'error', 'Terlalu banyak percobaan koneksi. Tunggu sebentar.');
  END IF;

  SELECT id, max_devices, status, expires_at, is_public, locked_fingerprint INTO _token
  FROM public.tokens WHERE code = _token_code;

  IF NOT FOUND OR _token.status = 'blocked' OR _token.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Token tidak valid');
  END IF;

  -- Public tokens: skip device lock entirely
  IF _token.is_public THEN
    SELECT id INTO _existing FROM public.token_sessions
    WHERE token_id = _token.id AND fingerprint = _fingerprint;
    IF FOUND THEN RETURN json_build_object('success', true, 'session_id', _existing.id); END IF;
    INSERT INTO public.token_sessions (token_id, fingerprint, user_agent)
    VALUES (_token.id, _fingerprint, _user_agent) RETURNING * INTO _new_session;
    RETURN json_build_object('success', true, 'session_id', _new_session.id);
  END IF;

  -- Private token: enforce hard fingerprint lock
  IF _token.locked_fingerprint IS NOT NULL AND _token.locked_fingerprint <> _fingerprint THEN
    RETURN json_build_object('success', false, 'error', 'Token sudah terkunci di perangkat lain');
  END IF;

  SELECT id INTO _existing FROM public.token_sessions
  WHERE token_id = _token.id AND fingerprint = _fingerprint;
  IF FOUND THEN RETURN json_build_object('success', true, 'session_id', _existing.id); END IF;

  SELECT count(*) INTO _session_count FROM public.token_sessions WHERE token_id = _token.id;
  IF _session_count >= COALESCE(_token.max_devices, 1) THEN
    RETURN json_build_object('success', false, 'error', 'Batas perangkat tercapai');
  END IF;

  INSERT INTO public.token_sessions (token_id, fingerprint, user_agent)
  VALUES (_token.id, _fingerprint, _user_agent) RETURNING * INTO _new_session;

  -- Lock the fingerprint on first connect
  IF _token.locked_fingerprint IS NULL THEN
    UPDATE public.tokens SET locked_fingerprint = _fingerprint WHERE id = _token.id;
  END IF;

  RETURN json_build_object('success', true, 'session_id', _new_session.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.self_reset_token_session(_token_code text, _fingerprint text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token record;
  _today_count int;
  _max_resets int;
  _is_long boolean;
BEGIN
  SELECT id, status, expires_at, is_public, duration_type, created_at, show_id
  INTO _token FROM public.tokens WHERE code = _token_code;

  IF NOT FOUND OR _token.status = 'blocked' OR _token.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Token tidak valid');
  END IF;

  IF _token.is_public THEN
    RETURN json_build_object('success', false, 'error', 'Token publik tidak perlu reset');
  END IF;

  -- Long-lived (>3 days) OR membership/show-linked tokens get 3 resets/day
  _is_long := (_token.duration_type IN ('weekly','monthly'))
    OR (_token.expires_at - _token.created_at > interval '3 days')
    OR (_token.show_id IS NOT NULL);
  _max_resets := CASE WHEN _is_long THEN 3 ELSE 1 END;

  SELECT count(*) INTO _today_count
  FROM public.session_resets
  WHERE token_code = _token_code
    AND fingerprint = _fingerprint
    AND reset_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';

  IF _today_count >= _max_resets THEN
    RETURN json_build_object('success', false,
      'error', 'Kuota reset hari ini sudah habis (maks ' || _max_resets || 'x/hari)',
      'resets_used', _today_count, 'max_resets', _max_resets);
  END IF;

  -- Clear sessions AND release the device lock so user can rebind on next connect
  DELETE FROM public.token_sessions WHERE token_id = _token.id;
  UPDATE public.tokens SET locked_fingerprint = NULL WHERE id = _token.id;

  INSERT INTO public.session_resets (token_code, fingerprint) VALUES (_token_code, _fingerprint);

  RETURN json_build_object('success', true,
    'resets_used', _today_count + 1,
    'resets_remaining', _max_resets - _today_count - 1,
    'max_resets', _max_resets);
END;
$function$;
