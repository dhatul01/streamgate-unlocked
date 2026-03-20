
CREATE SEQUENCE IF NOT EXISTS public.password_reset_requests_short_id_seq START 1;

CREATE TABLE public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text NOT NULL DEFAULT ('r' || nextval('password_reset_requests_short_id_seq'::regclass)),
  user_id uuid NOT NULL,
  identifier text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  new_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reset request"
  ON public.password_reset_requests FOR INSERT
  TO public
  WITH CHECK (status = 'pending');

CREATE POLICY "Admins can manage reset requests"
  ON public.password_reset_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- RPC to request password reset (finds user by phone or email, creates request, returns short_id)
CREATE OR REPLACE FUNCTION public.request_password_reset(_identifier text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _phone text;
  _username text;
  _short_id text;
  _normalized text;
  _email_lookup text;
  _allowed boolean;
BEGIN
  _normalized := trim(_identifier);
  IF _normalized = '' THEN RETURN json_build_object('success', false, 'error', 'Masukkan nomor HP atau email'); END IF;

  -- Rate limit: 3 requests per 10 minutes per identifier
  SELECT public.check_rate_limit('pw_reset:' || _normalized, 3, 600) INTO _allowed;
  IF NOT _allowed THEN
    RETURN json_build_object('success', false, 'error', 'Terlalu banyak percobaan. Tunggu beberapa menit.');
  END IF;

  -- Try as phone number: derive email = <digits>@rt48.user
  IF _normalized ~ '^[0-9]' THEN
    _email_lookup := regexp_replace(_normalized, '[^0-9]', '', 'g') || '@rt48.user';
  ELSE
    _email_lookup := _normalized;
  END IF;

  -- Look up user in auth.users
  SELECT id INTO _user_id FROM auth.users WHERE email = _email_lookup;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Akun tidak ditemukan');
  END IF;

  -- Check no pending request already
  IF EXISTS (SELECT 1 FROM public.password_reset_requests WHERE user_id = _user_id AND status = 'pending' AND created_at > now() - interval '1 hour') THEN
    RETURN json_build_object('success', false, 'error', 'Sudah ada permintaan reset yang belum diproses. Tunggu admin mengkonfirmasi.');
  END IF;

  SELECT username INTO _username FROM public.profiles WHERE id = _user_id;

  -- Determine phone for WhatsApp notification
  IF _normalized ~ '^[0-9]' THEN
    _phone := regexp_replace(_normalized, '[^0-9]', '', 'g');
  ELSE
    _phone := '';
  END IF;

  INSERT INTO public.password_reset_requests (user_id, identifier, phone)
  VALUES (_user_id, _normalized, _phone)
  RETURNING short_id INTO _short_id;

  RETURN json_build_object('success', true, 'short_id', _short_id, 'username', COALESCE(_username, ''));
END;
$$;
