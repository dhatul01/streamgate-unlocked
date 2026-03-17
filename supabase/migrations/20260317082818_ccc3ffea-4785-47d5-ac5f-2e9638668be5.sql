
-- Table to track user self-reset usage (2x per day limit)
CREATE TABLE public.session_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_code text NOT NULL,
  fingerprint text NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed - accessed via security definer function only
ALTER TABLE public.session_resets ENABLE ROW LEVEL SECURITY;

-- Allow public insert/select via the RPC only (no direct access)

-- RPC: self-reset session with 2x/day limit
CREATE OR REPLACE FUNCTION public.self_reset_token_session(_token_code text, _fingerprint text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token record;
  _today_count int;
BEGIN
  -- Validate token exists and is valid
  SELECT id, status, expires_at, is_public INTO _token
  FROM public.tokens WHERE code = _token_code;

  IF NOT FOUND OR _token.status = 'blocked' OR _token.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Token tidak valid');
  END IF;

  -- Public tokens don't need reset
  IF _token.is_public THEN
    RETURN json_build_object('success', false, 'error', 'Token publik tidak perlu reset');
  END IF;

  -- Check how many resets today for this token+fingerprint
  SELECT count(*) INTO _today_count
  FROM public.session_resets
  WHERE token_code = _token_code
    AND fingerprint = _fingerprint
    AND reset_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';

  IF _today_count >= 2 THEN
    RETURN json_build_object('success', false, 'error', 'Kuota reset hari ini sudah habis (maks 2x/hari)', 'resets_used', _today_count);
  END IF;

  -- Delete all sessions for this token
  DELETE FROM public.token_sessions WHERE token_id = _token.id;

  -- Log the reset
  INSERT INTO public.session_resets (token_code, fingerprint) VALUES (_token_code, _fingerprint);

  RETURN json_build_object('success', true, 'resets_used', _today_count + 1, 'resets_remaining', 1 - _today_count);
END;
$$;
