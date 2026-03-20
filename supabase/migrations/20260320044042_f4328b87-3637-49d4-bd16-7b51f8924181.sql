
-- Add replay_coin_price column to shows
ALTER TABLE public.shows ADD COLUMN replay_coin_price integer NOT NULL DEFAULT 0;

-- Update get_public_shows to include replay_coin_price
CREATE OR REPLACE FUNCTION public.get_public_shows()
 RETURNS SETOF shows
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, s.title, s.price, s.lineup, s.schedule_date, s.schedule_time, 
         s.background_image_url, s.qris_image_url, s.sort_order, s.is_active,
         s.created_at, s.is_subscription, s.max_subscribers, s.subscription_benefits, 
         s.group_link, s.is_order_closed, s.category, s.category_member, s.coin_price,
         ''::text as access_password, s.replay_coin_price
  FROM public.shows s
  WHERE s.is_active = true
  ORDER BY s.sort_order;
$function$;

-- Create redeem_coins_for_replay function
CREATE OR REPLACE FUNCTION public.redeem_coins_for_replay(_show_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _show RECORD; _balance INTEGER; _replay_pw TEXT;
BEGIN
  SELECT * INTO _show FROM public.shows WHERE id = _show_id AND is_active = true;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Show tidak ditemukan'); END IF;
  IF _show.replay_coin_price <= 0 THEN RETURN json_build_object('success', false, 'error', 'Replay tidak tersedia untuk show ini'); END IF;
  
  SELECT cb.balance INTO _balance FROM public.coin_balances cb WHERE cb.user_id = auth.uid();
  IF _balance IS NULL OR _balance < _show.replay_coin_price THEN 
    RETURN json_build_object('success', false, 'error', 'Koin tidak cukup'); 
  END IF;
  
  UPDATE public.coin_balances SET balance = balance - _show.replay_coin_price, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
  VALUES (auth.uid(), -_show.replay_coin_price, 'replay_redeem', _show_id::text, 'Tukar koin untuk replay ' || _show.title);
  
  _replay_pw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  
  RETURN json_build_object(
    'success', true,
    'replay_password', _replay_pw,
    'remaining_balance', _balance - _show.replay_coin_price
  );
END; $function$;
