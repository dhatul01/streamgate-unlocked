
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS coin_price INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.confirm_coin_order(_order_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _order RECORD; _new_balance INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN json_build_object('success', false, 'error', 'Unauthorized'); END IF;
  SELECT * INTO _order FROM public.coin_orders WHERE id = _order_id AND status = 'pending';
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Order not found'); END IF;
  UPDATE public.coin_orders SET status = 'confirmed' WHERE id = _order_id;
  INSERT INTO public.coin_balances (user_id, balance, updated_at) VALUES (_order.user_id, _order.coin_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET balance = coin_balances.balance + _order.coin_amount, updated_at = now();
  SELECT balance INTO _new_balance FROM public.coin_balances WHERE user_id = _order.user_id;
  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
  VALUES (_order.user_id, _order.coin_amount, 'purchase', _order_id::text, 'Pembelian ' || _order.coin_amount || ' koin');
  RETURN json_build_object('success', true, 'new_balance', _new_balance);
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_coins_for_token(_show_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  INSERT INTO public.tokens (code, duration_type, expires_at, max_devices, is_public, status)
  VALUES (_token_code, 'daily', _expires, 1, false, 'active');
  RETURN json_build_object('success', true, 'token_code', _token_code, 'expires_at', _expires, 'remaining_balance', _balance - _show.coin_price);
END; $$;
