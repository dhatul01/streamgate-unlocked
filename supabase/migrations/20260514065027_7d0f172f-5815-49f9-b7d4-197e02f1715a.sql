CREATE OR REPLACE FUNCTION public.bot_create_token(
  _actor_phone text,
  _duration_type text,
  _max_devices integer DEFAULT 1,
  _is_admin boolean DEFAULT false,
  _show_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reseller record;
  _show_title text := NULL;
  _show_is_subscription boolean := NULL;
  _show_is_active boolean := NULL;
  _normalized text;
  _expires timestamptz;
  _replay_expires timestamptz;
  _prefix text;
  _final_code text;
  _token record;
  _attempts int := 0;
  _effective_devices integer;
BEGIN
  _normalized := CASE lower(trim(_duration_type))
    WHEN 'harian' THEN 'daily' WHEN 'mingguan' THEN 'weekly' WHEN 'bulanan' THEN 'monthly'
    WHEN 'daily' THEN 'daily' WHEN 'weekly' THEN 'weekly' WHEN 'monthly' THEN 'monthly'
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

  IF _show_id IS NOT NULL THEN
    SELECT title, is_subscription, is_active
      INTO _show_title, _show_is_subscription, _show_is_active
    FROM public.shows WHERE id = _show_id;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Show tidak ditemukan');
    END IF;
    IF NOT _show_is_active THEN
      RETURN json_build_object('success', false, 'error', 'Show tidak aktif');
    END IF;
  END IF;

  _effective_devices := GREATEST(LEAST(COALESCE(_max_devices, 1), 5), 1);
  IF _show_id IS NOT NULL AND _show_is_subscription = false THEN
    _effective_devices := 1;
  END IF;

  IF _is_admin THEN
    _prefix := 'ADM';
  ELSE
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

  LOOP
    _final_code := _prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tokens WHERE code = _final_code);
    _attempts := _attempts + 1;
    IF _attempts > 8 THEN
      RETURN json_build_object('success', false, 'error', 'Gagal generate kode unik');
    END IF;
  END LOOP;

  INSERT INTO public.tokens (
    code, duration_type, expires_at, max_devices,
    status, is_public, locked_fingerprint, replay_expires_at,
    created_by_reseller_id, show_id
  ) VALUES (
    _final_code, _normalized, _expires, _effective_devices,
    'active', false, NULL, _replay_expires,
    CASE WHEN _is_admin THEN NULL ELSE _reseller.id END,
    _show_id
  ) RETURNING * INTO _token;

  IF NOT _is_admin THEN
    UPDATE public.resellers
      SET token_quota = token_quota - 1,
          total_tokens_created = total_tokens_created + 1,
          updated_at = now()
    WHERE id = _reseller.id;
    INSERT INTO public.reseller_audit_logs (reseller_id, action, target_token_id, metadata)
    VALUES (_reseller.id, 'create_token_bot', _token.id,
      jsonb_build_object('code', _token.code, 'via', 'whatsapp_bot', 'phone', _actor_phone,
        'show_id', _show_id, 'max_devices', _effective_devices));
  END IF;

  RETURN json_build_object(
    'success', true,
    'code', _token.code,
    'duration_type', _token.duration_type,
    'expires_at', _token.expires_at,
    'replay_expires_at', _token.replay_expires_at,
    'max_devices', _token.max_devices,
    'show_id', _token.show_id,
    'show_title', _show_title,
    'remaining_quota', CASE WHEN _is_admin THEN NULL ELSE _reseller.token_quota - 1 END,
    'reseller_username', CASE WHEN _is_admin THEN NULL ELSE _reseller.username END
  );
END;
$$;