
-- 1. Add embed columns to shows
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS replay_embed_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS replay_embed_type text NOT NULL DEFAULT 'm3u8';

-- 2. Add replay_expires_at to tokens
ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS replay_expires_at timestamptz;

-- Backfill existing tokens
UPDATE public.tokens
  SET replay_expires_at = expires_at + interval '14 days'
  WHERE replay_expires_at IS NULL;

-- Trigger: auto-set replay_expires_at on insert / when expires_at changes
CREATE OR REPLACE FUNCTION public.set_replay_expires_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.replay_expires_at IS NULL OR (TG_OP = 'UPDATE' AND NEW.expires_at IS DISTINCT FROM OLD.expires_at) THEN
    NEW.replay_expires_at := NEW.expires_at + interval '14 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_replay_expires_at ON public.tokens;
CREATE TRIGGER trg_set_replay_expires_at
  BEFORE INSERT OR UPDATE ON public.tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_replay_expires_at();

-- 3. Update get_public_shows to mask replay_embed_url
CREATE OR REPLACE FUNCTION public.get_public_shows()
RETURNS SETOF public.shows
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.price, s.lineup, s.schedule_date, s.schedule_time,
         s.background_image_url, s.qris_image_url, s.sort_order, s.is_active,
         s.created_at, s.is_subscription, s.max_subscribers, s.subscription_benefits,
         s.group_link, s.is_order_closed, s.category, s.category_member, s.coin_price,
         ''::text as access_password, s.replay_coin_price, s.is_replay,
         ''::text as replay_embed_url, s.replay_embed_type
  FROM public.shows s
  WHERE s.is_active = true
  ORDER BY s.sort_order;
$$;

-- 4. RPC: get_replay_access for token holders
CREATE OR REPLACE FUNCTION public.get_replay_access(_token_code text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token record;
  _shows json;
BEGIN
  SELECT id, status, expires_at, replay_expires_at, code
  INTO _token FROM public.tokens WHERE code = _token_code;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Token tidak ditemukan');
  END IF;
  IF _token.status = 'blocked' THEN
    RETURN json_build_object('valid', false, 'error', 'Token diblokir');
  END IF;
  IF _token.replay_expires_at IS NULL OR now() > _token.replay_expires_at THEN
    RETURN json_build_object('valid', false, 'error', 'Akses replay kadaluarsa');
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO _shows
  FROM (
    SELECT s.id, s.title, s.lineup, s.schedule_date, s.schedule_time,
           s.background_image_url, s.category, s.category_member,
           s.replay_embed_type,
           CASE
             WHEN s.replay_embed_url = '' THEN ''
             WHEN s.replay_embed_type = 'youtube' THEN 'enc:' || public.obfuscate_url(s.replay_embed_url)
             ELSE s.replay_embed_url
           END AS replay_embed_url
    FROM public.shows s
    WHERE s.is_active = true AND s.is_replay = true
    ORDER BY s.schedule_date DESC, s.sort_order
  ) r;

  RETURN json_build_object(
    'valid', true,
    'replay_expires_at', _token.replay_expires_at,
    'shows', _shows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_replay_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_replay_access(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_shows() TO anon, authenticated;
