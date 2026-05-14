
-- 1. Add 'reseller' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reseller';

-- 2. Resellers table
CREATE TABLE IF NOT EXISTS public.resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  token_quota integer NOT NULL DEFAULT 0,
  total_tokens_created integer NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage resellers" ON public.resellers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Resellers can read own profile" ON public.resellers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER resellers_updated_at
  BEFORE UPDATE ON public.resellers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Quota logs
CREATE TABLE IF NOT EXISTS public.reseller_quota_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_quota_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quota logs" ON public.reseller_quota_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Resellers read own quota logs" ON public.reseller_quota_logs
  FOR SELECT TO authenticated
  USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));

-- 4. Audit logs
CREATE TABLE IF NOT EXISTS public.reseller_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL,
  action text NOT NULL,
  target_token_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reseller_audit_logs_reseller_idx ON public.reseller_audit_logs (reseller_id, created_at DESC);

ALTER TABLE public.reseller_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage audit logs" ON public.reseller_audit_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Resellers read own audit logs" ON public.reseller_audit_logs
  FOR SELECT TO authenticated
  USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));

-- 5. Tokens: tag created_by_reseller_id
ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS created_by_reseller_id uuid;

CREATE INDEX IF NOT EXISTS tokens_reseller_idx ON public.tokens (created_by_reseller_id);

CREATE POLICY "Resellers can read own tokens" ON public.tokens
  FOR SELECT TO authenticated
  USING (created_by_reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));

CREATE POLICY "Resellers can update own tokens" ON public.tokens
  FOR UPDATE TO authenticated
  USING (created_by_reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()));

-- 6. RPC: reseller_create_token (anti-duplicate, kuota check)
CREATE OR REPLACE FUNCTION public.reseller_create_token(
  _code text,
  _duration_type text,
  _expires_at timestamptz,
  _max_devices integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _reseller record;
  _token record;
  _final_code text;
  _attempts int := 0;
  _normalized_duration text;
BEGIN
  SELECT id, username, token_quota, is_active INTO _reseller
  FROM public.resellers WHERE user_id = auth.uid();

  IF NOT FOUND OR NOT _reseller.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Bukan reseller aktif');
  END IF;

  IF _reseller.token_quota <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Kuota token habis. Hubungi admin untuk top-up.');
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

  IF _expires_at IS NULL OR _expires_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'Tanggal kadaluarsa tidak valid');
  END IF;

  -- Determine final code: custom or auto-generated
  IF _code IS NOT NULL AND length(trim(_code)) > 0 THEN
    _final_code := upper(trim(_code));
    IF EXISTS (SELECT 1 FROM public.tokens WHERE code = _final_code) THEN
      RETURN json_build_object('success', false, 'error', 'Kode token sudah dipakai. Pilih kode lain.');
    END IF;
  ELSE
    LOOP
      _final_code := 'RSL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tokens WHERE code = _final_code);
      _attempts := _attempts + 1;
      IF _attempts > 5 THEN
        RETURN json_build_object('success', false, 'error', 'Gagal generate kode unik. Coba lagi.');
      END IF;
    END LOOP;
  END IF;

  -- Insert FRESH token (no copy of existing data, no locked_fingerprint)
  INSERT INTO public.tokens (
    code, duration_type, expires_at, max_devices,
    status, is_public, locked_fingerprint, created_by_reseller_id
  ) VALUES (
    _final_code, _normalized_duration, _expires_at,
    GREATEST(COALESCE(_max_devices, 1), 1),
    'active', false, NULL, _reseller.id
  ) RETURNING * INTO _token;

  -- Decrement quota, increment counter
  UPDATE public.resellers
  SET token_quota = token_quota - 1,
      total_tokens_created = total_tokens_created + 1,
      updated_at = now()
  WHERE id = _reseller.id;

  -- Audit log
  INSERT INTO public.reseller_audit_logs (reseller_id, action, target_token_id, metadata)
  VALUES (_reseller.id, 'create_token', _token.id,
    jsonb_build_object('code', _token.code, 'duration', _normalized_duration, 'expires_at', _expires_at));

  RETURN json_build_object(
    'success', true,
    'id', _token.id,
    'code', _token.code,
    'duration_type', _token.duration_type,
    'expires_at', _token.expires_at,
    'remaining_quota', _reseller.token_quota - 1
  );
END;
$$;

-- 7. RPC: reseller stats
CREATE OR REPLACE FUNCTION public.reseller_get_my_stats()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _reseller record;
  _active_tokens int;
  _expired_tokens int;
BEGIN
  SELECT * INTO _reseller FROM public.resellers WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bukan reseller');
  END IF;

  SELECT count(*) INTO _active_tokens FROM public.tokens
  WHERE created_by_reseller_id = _reseller.id AND status = 'active' AND expires_at > now();

  SELECT count(*) INTO _expired_tokens FROM public.tokens
  WHERE created_by_reseller_id = _reseller.id AND (status = 'blocked' OR expires_at <= now());

  RETURN json_build_object(
    'success', true,
    'reseller_id', _reseller.id,
    'username', _reseller.username,
    'full_name', _reseller.full_name,
    'token_quota', _reseller.token_quota,
    'total_tokens_created', _reseller.total_tokens_created,
    'active_tokens', _active_tokens,
    'expired_tokens', _expired_tokens,
    'is_active', _reseller.is_active
  );
END;
$$;

-- 8. RPC: admin top-up quota
CREATE OR REPLACE FUNCTION public.admin_topup_reseller_quota(
  _reseller_id uuid,
  _amount integer,
  _reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_quota int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF _amount = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Jumlah tidak boleh 0');
  END IF;

  UPDATE public.resellers
  SET token_quota = GREATEST(token_quota + _amount, 0),
      updated_at = now()
  WHERE id = _reseller_id
  RETURNING token_quota INTO _new_quota;

  IF _new_quota IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Reseller tidak ditemukan');
  END IF;

  INSERT INTO public.reseller_quota_logs (reseller_id, amount, reason, created_by)
  VALUES (_reseller_id, _amount, COALESCE(_reason, ''), auth.uid());

  RETURN json_build_object('success', true, 'new_quota', _new_quota);
END;
$$;

-- 9. RPC: reseller logs custom action (e.g. login)
CREATE OR REPLACE FUNCTION public.reseller_log_action(
  _action text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _reseller_id uuid;
BEGIN
  SELECT id INTO _reseller_id FROM public.resellers WHERE user_id = auth.uid();
  IF _reseller_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.reseller_audit_logs (reseller_id, action, metadata)
  VALUES (_reseller_id, _action, COALESCE(_metadata, '{}'::jsonb));
END;
$$;
