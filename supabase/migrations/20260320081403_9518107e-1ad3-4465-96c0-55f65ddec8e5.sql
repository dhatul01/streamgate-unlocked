
-- 1. Add show_id to tokens table to link tokens to specific shows
ALTER TABLE public.tokens ADD COLUMN show_id uuid REFERENCES public.shows(id) ON DELETE SET NULL;

-- 2. Helper function to parse Indonesian date/time strings into timestamptz
CREATE OR REPLACE FUNCTION public.parse_show_datetime(_date text, _time text)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _clean_time text;
  _hour int;
  _minute int;
  _parts text[];
  _day int;
  _month int;
  _year int;
  _month_map jsonb := '{"januari":1,"februari":2,"maret":3,"april":4,"mei":5,"juni":6,"juli":7,"agustus":8,"september":9,"oktober":10,"november":11,"desember":12}';
  _result timestamptz;
BEGIN
  IF _date IS NULL OR _date = '' OR _time IS NULL OR _time = '' THEN RETURN NULL; END IF;

  _clean_time := regexp_replace(trim(_time), '\s*WIB\s*', '', 'i');
  _clean_time := replace(_clean_time, '.', ':');
  _hour := split_part(_clean_time, ':', 1)::int;
  _minute := COALESCE(NULLIF(split_part(_clean_time, ':', 2), '')::int, 0);

  -- Try ISO format (2026-03-20)
  BEGIN
    _result := (_date || ' ' || lpad(_hour::text, 2, '0') || ':' || lpad(_minute::text, 2, '0') || ':00+07')::timestamptz;
    RETURN _result;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Try Indonesian format (20 maret 2026)
  _parts := string_to_array(lower(trim(_date)), ' ');
  IF array_length(_parts, 1) = 3 THEN
    _day := _parts[1]::int;
    _month := (_month_map->>_parts[2])::int;
    _year := _parts[3]::int;
    IF _month IS NOT NULL THEN
      _result := make_timestamptz(_year, _month, _day, _hour, _minute, 0, 'Asia/Jakarta');
      RETURN _result;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Update redeem_coins_for_token: set show_id + schedule-based expiry
CREATE OR REPLACE FUNCTION public.redeem_coins_for_token(_show_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _show RECORD; _balance INTEGER; _token_code TEXT;
  _expires TIMESTAMPTZ; _show_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO _show FROM public.shows WHERE id = _show_id AND is_active = true;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Show tidak ditemukan'); END IF;
  IF _show.coin_price <= 0 THEN RETURN json_build_object('success', false, 'error', 'Show tidak bisa dibeli dengan koin'); END IF;

  SELECT cb.balance INTO _balance FROM public.coin_balances cb WHERE cb.user_id = auth.uid();
  IF _balance IS NULL OR _balance < _show.coin_price THEN RETURN json_build_object('success', false, 'error', 'Koin tidak cukup'); END IF;

  UPDATE public.coin_balances SET balance = balance - _show.coin_price, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
  VALUES (auth.uid(), -_show.coin_price, 'redeem', _show_id::text, 'Tukar koin untuk ' || _show.title);

  _token_code := 'COIN-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  -- Calculate expiry: show_start + 4 hours (buffer for show duration)
  _show_start := public.parse_show_datetime(_show.schedule_date, _show.schedule_time);
  IF _show_start IS NOT NULL THEN
    _expires := _show_start + interval '4 hours';
    -- Ensure token is at least valid until show starts
    IF _expires < now() THEN _expires := now() + interval '4 hours'; END IF;
  ELSE
    _expires := now() + interval '1 day';
  END IF;

  INSERT INTO public.tokens (code, duration_type, expires_at, max_devices, is_public, status, replay_password, buyer_user_id, show_id)
  VALUES (_token_code, 'show', _expires, 1, false, 'active', _show.access_password, auth.uid(), _show_id);

  RETURN json_build_object(
    'success', true,
    'token_code', _token_code,
    'expires_at', _expires,
    'remaining_balance', _balance - _show.coin_price,
    'replay_password', _show.access_password,
    'access_password', _show.access_password
  );
END;
$$;

-- 4. Update validate_token: check show time window
CREATE OR REPLACE FUNCTION public.validate_token(_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token record;
  _show_start timestamptz;
  _show_title text;
BEGIN
  SELECT t.id, t.code, t.max_devices, t.duration_type, t.expires_at, t.status, t.is_public, t.show_id
  INTO _token FROM public.tokens t WHERE t.code = _code;

  IF NOT FOUND THEN RETURN json_build_object('valid', false, 'error', 'Token tidak valid'); END IF;
  IF _token.status = 'blocked' THEN RETURN json_build_object('valid', false, 'error', 'Token telah diblokir'); END IF;
  IF _token.expires_at < now() THEN RETURN json_build_object('valid', false, 'error', 'Token telah expired'); END IF;

  -- Show-linked token: check time window (30 min before show)
  IF _token.show_id IS NOT NULL THEN
    SELECT public.parse_show_datetime(s.schedule_date, s.schedule_time), s.title
    INTO _show_start, _show_title
    FROM public.shows s WHERE s.id = _token.show_id;

    IF _show_start IS NOT NULL AND now() < (_show_start - interval '30 minutes') THEN
      RETURN json_build_object('valid', false, 'error',
        'Show "' || COALESCE(_show_title, '') || '" belum dimulai. Akses dibuka 30 menit sebelum jadwal.',
        'show_start', _show_start, 'show_title', _show_title);
    END IF;
  END IF;

  RETURN json_build_object(
    'valid', true, 'id', _token.id, 'code', _token.code,
    'max_devices', _token.max_devices, 'expires_at', _token.expires_at,
    'status', _token.status, 'is_public', _token.is_public, 'show_id', _token.show_id
  );
END;
$$;

-- 5. Update get_playlists_for_token: restrict access based on show schedule
CREATE OR REPLACE FUNCTION public.get_playlists_for_token(_token_code text)
RETURNS SETOF playlists
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token record;
  _show_start timestamptz;
BEGIN
  SELECT t.id, t.status, t.expires_at, t.show_id
  INTO _token FROM public.tokens t WHERE t.code = _token_code;

  IF NOT FOUND OR _token.status = 'blocked' OR _token.expires_at < now() THEN RETURN; END IF;

  -- Show-linked token: only allow access within time window
  IF _token.show_id IS NOT NULL THEN
    SELECT public.parse_show_datetime(s.schedule_date, s.schedule_time)
    INTO _show_start FROM public.shows s WHERE s.id = _token.show_id;

    IF _show_start IS NOT NULL AND now() < (_show_start - interval '30 minutes') THEN
      RETURN; -- Too early, no playlists returned
    END IF;
  END IF;

  RETURN QUERY
    SELECT p.id, p.stream_id, p.label, p.type,
      CASE WHEN p.type = 'youtube' THEN 'enc:' || public.obfuscate_url(p.url) ELSE p.url END as url,
      p.sort_order, p.created_at
    FROM public.playlists p
    ORDER BY sort_order;
END;
$$;
