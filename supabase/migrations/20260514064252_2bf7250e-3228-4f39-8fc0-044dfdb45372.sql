CREATE OR REPLACE FUNCTION public.self_request_password_reset(_identifier text, _token_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _email_lookup text;
  _phone text;
  _normalized text;
  _allowed boolean;
BEGIN
  _normalized := trim(_identifier);
  IF _normalized = '' THEN
    RETURN json_build_object('success', false, 'error', 'Masukkan email atau nomor HP');
  END IF;

  SELECT public.check_rate_limit('self_pw:' || _normalized, 5, 600) INTO _allowed;
  IF NOT _allowed THEN
    RETURN json_build_object('success', false, 'error', 'Terlalu banyak percobaan. Tunggu 10 menit.');
  END IF;

  IF _normalized ~ '^[0-9+]' THEN
    _phone := regexp_replace(_normalized, '[^0-9]', '', 'g');
    _email_lookup := _phone || '@rt48.user';
  ELSE
    _email_lookup := lower(_normalized);
    _phone := '';
  END IF;

  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = lower(_email_lookup);

  IF _user_id IS NULL THEN
    RETURN json_build_object('success', true, 'found', false);
  END IF;

  UPDATE public.self_password_resets
    SET used_at = now()
  WHERE user_id = _user_id AND used_at IS NULL;

  INSERT INTO public.self_password_resets (user_id, token_hash, phone, expires_at)
  VALUES (_user_id, _token_hash, _phone, now() + interval '20 minutes');

  RETURN json_build_object('success', true, 'found', true, 'phone', _phone, 'user_id', _user_id);
END;
$$;