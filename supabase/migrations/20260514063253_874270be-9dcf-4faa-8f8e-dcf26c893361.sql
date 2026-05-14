
-- 1. Reseller prefix + bot toggle
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS prefix text NOT NULL DEFAULT 'RSL',
  ADD COLUMN IF NOT EXISTS bot_enabled boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS resellers_prefix_unique ON public.resellers (upper(prefix));

-- 2. Reseller phones
CREATE TABLE IF NOT EXISTS public.reseller_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  phone text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reseller_phones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage reseller phones" ON public.reseller_phones;
CREATE POLICY "Admins manage reseller phones" ON public.reseller_phones
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Resellers read own phones" ON public.reseller_phones;
CREATE POLICY "Resellers read own phones" ON public.reseller_phones
  FOR SELECT TO authenticated
  USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));

-- 3. Self-service password reset tokens
CREATE TABLE IF NOT EXISTS public.self_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  phone text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.self_password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage self resets" ON public.self_password_resets;
CREATE POLICY "Admins manage self resets" ON public.self_password_resets
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS self_password_resets_expires_idx ON public.self_password_resets (expires_at);

-- 4. bot_create_token — for both admin and reseller via WhatsApp bot.
--    Always generates a fresh, unique code; locked_fingerprint NULL; status active.
CREATE OR REPLACE FUNCTION public.bot_create_token(
  _actor_phone text,
  _duration_type text,
  _max_devices integer DEFAULT 1,
  _is_admin boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reseller record;
  _normalized text;
  _expires timestamptz;
  _replay_expires timestamptz;
  _prefix text;
  _final_code text;
  _token record;
  _attempts int := 0;
BEGIN
  -- Normalize duration
  _normalized := CASE lower(trim(_duration_type))
    WHEN 'harian' THEN 'daily'
    WHEN 'mingguan' THEN 'weekly'
    WHEN 'bulanan' THEN 'monthly'
    WHEN 'daily' THEN 'daily'
    WHEN 'weekly' THEN 'weekly'
    WHEN 'monthly' THEN 'monthly'
    ELSE NULL
  END;
  IF _normalized IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Durasi tidak valid (harian/mingguan/bulanan)');
  END IF;

  _expires := CASE _normalized
    WHEN 'daily' THEN now() + interval '1 day'
    WHEN 'weekly' THEN now() + interval '7 days'
    WHEN 'monthly' THEN now() + interval '30 days'
  END;
  _replay_expires := _expires + interval '14 days';

  IF _is_admin THEN
    _prefix := 'ADM';
  ELSE
    -- Look up reseller via phone
    SELECT r.* INTO _reseller
    FROM public.resellers r
    JOIN public.reseller_phones p ON p.reseller_id = r.id
    WHERE regexp_replace(p.phone, '[^0-9]', '', 'g') = regexp_replace(_actor_phone, '[^0-9]', '', 'g')
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Nomor tidak terdaftar sebagai reseller');
    END IF;
    IF NOT _reseller.is_active OR NOT _reseller.bot_enabled THEN
      RETURN json_build_object('success', false, 'error', 'Akses bot dinonaktifkan');
    END IF;
    IF _reseller.token_quota <= 0 THEN
      RETURN json_build_object('success', false, 'error', 'Kuota habis. Hubungi admin.');
    END IF;
    _prefix := COALESCE(NULLIF(upper(trim(_reseller.prefix)), ''), 'RSL');
  END IF;

  -- Generate unique code (never duplicate)
  LOOP
    _final_code := _prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tokens WHERE code = _final_code);
    _attempts := _attempts + 1;
    IF _attempts > 8 THEN
      RETURN json_build_object('success', false, 'error', 'Gagal generate kode unik');
    END IF;
  END LOOP;

  -- Insert FRESH token: no copying of fingerprint, no buyer_user_id, no show_id
  INSERT INTO public.tokens (
    code, duration_type, expires_at, max_devices,
    status, is_public, locked_fingerprint, replay_expires_at,
    created_by_reseller_id
  ) VALUES (
    _final_code, _normalized, _expires,
    GREATEST(LEAST(COALESCE(_max_devices, 1), 5), 1),
    'active', false, NULL, _replay_expires,
    CASE WHEN _is_admin THEN NULL ELSE _reseller.id END
  ) RETURNING * INTO _token;

  -- Reseller bookkeeping
  IF NOT _is_admin THEN
    UPDATE public.resellers
      SET token_quota = token_quota - 1,
          total_tokens_created = total_tokens_created + 1,
          updated_at = now()
    WHERE id = _reseller.id;

    INSERT INTO public.reseller_audit_logs (reseller_id, action, target_token_id, metadata)
    VALUES (_reseller.id, 'create_token_bot', _token.id,
      jsonb_build_object('code', _token.code, 'via', 'whatsapp_bot', 'phone', _actor_phone));
  END IF;

  RETURN json_build_object(
    'success', true,
    'code', _token.code,
    'duration_type', _token.duration_type,
    'expires_at', _token.expires_at,
    'replay_expires_at', _token.replay_expires_at,
    'max_devices', _token.max_devices,
    'remaining_quota', CASE WHEN _is_admin THEN NULL ELSE _reseller.token_quota - 1 END,
    'reseller_username', CASE WHEN _is_admin THEN NULL ELSE _reseller.username END
  );
END;
$$;

-- 5. is_reseller_phone helper for the bot
CREATE OR REPLACE FUNCTION public.lookup_reseller_by_phone(_phone text)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', r.id, 'username', r.username, 'full_name', r.full_name,
    'token_quota', r.token_quota, 'total_tokens_created', r.total_tokens_created,
    'is_active', r.is_active, 'bot_enabled', r.bot_enabled, 'prefix', r.prefix
  )
  FROM public.resellers r
  JOIN public.reseller_phones p ON p.reseller_id = r.id
  WHERE regexp_replace(p.phone, '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g')
  LIMIT 1;
$$;

-- 6. Self-service password reset request
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

  -- Anti-enumeration: always return success even if not found
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', true, 'found', false);
  END IF;

  -- Invalidate previous unused tokens
  UPDATE public.self_password_resets
    SET used_at = now()
  WHERE user_id = _user_id AND used_at IS NULL;

  INSERT INTO public.self_password_resets (user_id, token_hash, phone, expires_at)
  VALUES (_user_id, _token_hash, _phone, now() + interval '30 minutes');

  RETURN json_build_object('success', true, 'found', true, 'phone', _phone, 'user_id', _user_id);
END;
$$;

-- 7. Self-service password reset consume (validate + mark used). Actual password update is done by edge function with service role.
CREATE OR REPLACE FUNCTION public.self_consume_password_reset(_token_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
BEGIN
  SELECT * INTO _row FROM public.self_password_resets
  WHERE token_hash = _token_hash;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Link tidak valid');
  END IF;
  IF _row.used_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Link sudah digunakan');
  END IF;
  IF _row.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Link kadaluarsa, minta link baru');
  END IF;

  UPDATE public.self_password_resets SET used_at = now() WHERE id = _row.id;
  RETURN json_build_object('success', true, 'user_id', _row.user_id);
END;
$$;

-- 8. Cleanup helper (cron-friendly)
CREATE OR REPLACE FUNCTION public.cleanup_self_password_resets()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.self_password_resets WHERE created_at < now() - interval '7 days';
$$;
