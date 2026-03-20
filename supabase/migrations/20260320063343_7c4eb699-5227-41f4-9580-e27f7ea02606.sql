
-- 1. Admin earnings table for gift revenue (GoPay withdrawal)
CREATE TABLE public.admin_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'gift',
  reference_id uuid NULL,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage earnings"
  ON public.admin_earnings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Admin withdrawal requests table
CREATE TABLE public.admin_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount integer NOT NULL,
  method text NOT NULL DEFAULT 'gopay',
  account_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

ALTER TABLE public.admin_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage withdrawals"
  ON public.admin_withdrawals FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Add user_id to tokens so coin-purchased tokens link to user accounts
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS buyer_user_id uuid NULL;

-- 4. Update send_coin_gift to also record admin earnings
CREATE OR REPLACE FUNCTION public.send_coin_gift(_amount integer, _message text, _gift_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _balance integer;
  _username text;
  _gift_id uuid;
BEGIN
  IF _amount < 1 THEN RETURN json_build_object('success', false, 'error', 'Minimum 1 koin'); END IF;
  IF _amount > 100 THEN RETURN json_build_object('success', false, 'error', 'Maksimum 100 koin per gift'); END IF;

  SELECT balance INTO _balance FROM public.coin_balances WHERE user_id = auth.uid();
  IF _balance IS NULL OR _balance < _amount THEN RETURN json_build_object('success', false, 'error', 'Koin tidak cukup'); END IF;
  
  SELECT username INTO _username FROM public.profiles WHERE id = auth.uid();

  UPDATE public.coin_balances SET balance = balance - _amount, updated_at = now() WHERE user_id = auth.uid();
  
  INSERT INTO public.coin_transactions (user_id, amount, type, description)
  VALUES (auth.uid(), -_amount, 'gift', 'Gift ' || _amount || ' koin (' || _gift_type || ')');

  INSERT INTO public.coin_gifts (sender_username, sender_user_id, amount, message, gift_type)
  VALUES (COALESCE(_username, 'Anonymous'), auth.uid(), _amount, _message, _gift_type)
  RETURNING id INTO _gift_id;

  -- Record admin earnings from gift
  INSERT INTO public.admin_earnings (amount, source, reference_id, description)
  VALUES (_amount, 'gift', _gift_id, 'Gift ' || _gift_type || ' dari ' || COALESCE(_username, 'Anonymous'));

  RETURN json_build_object('success', true, 'remaining_balance', _balance - _amount);
END;
$$;

-- 5. Update redeem_coins_for_token to store buyer_user_id
CREATE OR REPLACE FUNCTION public.redeem_coins_for_token(_show_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _show RECORD; _balance INTEGER; _token_code TEXT; _expires TIMESTAMPTZ;
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
  INSERT INTO public.tokens (code, duration_type, expires_at, max_devices, is_public, status, replay_password, buyer_user_id)
  VALUES (_token_code, 'daily', _expires, 1, false, 'active', _show.access_password, auth.uid());
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
