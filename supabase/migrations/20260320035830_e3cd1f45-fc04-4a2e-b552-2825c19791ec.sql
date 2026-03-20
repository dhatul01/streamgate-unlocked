
-- Add replay_password column to tokens table
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS replay_password text;

-- Update redeem function to generate replay password
CREATE OR REPLACE FUNCTION public.redeem_coins_for_token(_show_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _show RECORD; _balance INTEGER; _token_code TEXT; _expires TIMESTAMPTZ; _replay_pw TEXT;
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
  _expires := now() + interval '1 day';
  _replay_pw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  INSERT INTO public.tokens (code, duration_type, expires_at, max_devices, is_public, status, replay_password)
  VALUES (_token_code, 'daily', _expires, 1, false, 'active', _replay_pw);
  RETURN json_build_object('success', true, 'token_code', _token_code, 'expires_at', _expires, 'remaining_balance', _balance - _show.coin_price, 'replay_password', _replay_pw);
END; $function$;
