
-- Rate limiting table for tracking request counts
CREATE TABLE public.rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key)
);

-- No RLS needed - only accessed by SECURITY DEFINER functions
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup: delete stale entries older than 1 hour
CREATE INDEX idx_rate_limits_window ON public.rate_limits (window_start);

-- Core rate limit checker function
-- Returns TRUE if request is ALLOWED, FALSE if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key TEXT,
  _max_requests INTEGER,
  _window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _now TIMESTAMPTZ := now();
  _window_start TIMESTAMPTZ;
  _count INTEGER;
BEGIN
  -- Try to get existing record
  SELECT window_start, request_count INTO _window_start, _count
  FROM public.rate_limits
  WHERE key = _key;

  IF NOT FOUND THEN
    -- First request: create entry
    INSERT INTO public.rate_limits (key, window_start, request_count)
    VALUES (_key, _now, 1)
    ON CONFLICT (key) DO UPDATE SET window_start = _now, request_count = 1;
    RETURN TRUE;
  END IF;

  -- Check if window has expired
  IF _now > _window_start + (_window_seconds || ' seconds')::interval THEN
    -- Reset window
    UPDATE public.rate_limits
    SET window_start = _now, request_count = 1
    WHERE key = _key;
    RETURN TRUE;
  END IF;

  -- Window still active: check count
  IF _count >= _max_requests THEN
    RETURN FALSE; -- Rate limited!
  END IF;

  -- Increment counter
  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE key = _key;
  RETURN TRUE;
END;
$$;

-- Cleanup function to periodically remove stale entries
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
$$;

-- Update validate_token to include rate limiting (10 requests per 30 seconds per token code)
CREATE OR REPLACE FUNCTION public.validate_token(_code text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token record;
  _allowed boolean;
BEGIN
  -- Rate limit: 10 requests per 30 seconds per token code
  SELECT public.check_rate_limit('vt:' || _code, 10, 30) INTO _allowed;
  IF NOT _allowed THEN
    RETURN json_build_object('valid', false, 'error', 'Terlalu banyak percobaan. Coba lagi nanti.');
  END IF;

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

-- Update create_token_session to include rate limiting (5 requests per 60 seconds per fingerprint)
CREATE OR REPLACE FUNCTION public.create_token_session(_token_code text, _fingerprint text, _user_agent text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token record;
  _existing record;
  _session_count int;
  _new_session record;
  _allowed boolean;
BEGIN
  -- Rate limit: 5 requests per 60 seconds per fingerprint
  SELECT public.check_rate_limit('cs:' || _fingerprint, 5, 60) INTO _allowed;
  IF NOT _allowed THEN
    RETURN json_build_object('success', false, 'error', 'Terlalu banyak percobaan koneksi. Tunggu sebentar.');
  END IF;

  SELECT id, max_devices, status, expires_at, is_public INTO _token
  FROM public.tokens WHERE code = _token_code;

  IF NOT FOUND OR _token.status = 'blocked' OR _token.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Token tidak valid');
  END IF;

  -- For public tokens, skip device limit entirely
  IF _token.is_public THEN
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
