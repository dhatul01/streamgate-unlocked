
-- Allow users to delete their own poll votes (to change vote)
CREATE POLICY "Anyone can delete own vote"
ON public.poll_votes
FOR DELETE
USING (true);

-- Add payment_method column to subscription_orders
ALTER TABLE public.subscription_orders 
ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'qris';

-- Make payment_proof_url nullable for coin purchases
-- Drop the existing constraint that requires non-empty payment_proof_url
DROP POLICY IF EXISTS "Anyone can submit orders" ON public.subscription_orders;
CREATE POLICY "Anyone can submit orders"
ON public.subscription_orders
FOR INSERT
TO public
WITH CHECK (
  (status = 'pending') AND 
  (show_id IS NOT NULL) AND 
  (phone <> '') AND 
  (email <> '') AND
  (
    (payment_method = 'coin' AND payment_proof_url = '') OR
    (payment_method = 'qris' AND payment_proof_url <> '')
  )
);

-- Create RPC for coin-based membership purchase
CREATE OR REPLACE FUNCTION public.redeem_coins_for_membership(_show_id uuid, _phone text, _email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _show RECORD;
  _balance INTEGER;
  _price INTEGER;
BEGIN
  SELECT * INTO _show FROM public.shows WHERE id = _show_id AND is_active = true AND is_subscription = true;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Membership tidak ditemukan'); END IF;
  IF _show.is_order_closed THEN RETURN json_build_object('success', false, 'error', 'Pendaftaran ditutup'); END IF;
  IF _show.coin_price <= 0 THEN RETURN json_build_object('success', false, 'error', 'Membership tidak bisa dibeli dengan koin'); END IF;

  -- Check capacity
  IF _show.max_subscribers > 0 THEN
    IF (SELECT count(*) FROM public.subscription_orders WHERE show_id = _show_id AND status IN ('pending','confirmed')) >= _show.max_subscribers THEN
      RETURN json_build_object('success', false, 'error', 'Membership sudah penuh');
    END IF;
  END IF;

  _price := _show.coin_price;

  SELECT cb.balance INTO _balance FROM public.coin_balances cb WHERE cb.user_id = auth.uid();
  IF _balance IS NULL OR _balance < _price THEN
    RETURN json_build_object('success', false, 'error', 'Koin tidak cukup');
  END IF;

  -- Deduct coins
  UPDATE public.coin_balances SET balance = balance - _price, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description)
  VALUES (auth.uid(), -_price, 'membership', _show_id::text, 'Membership ' || _show.title);

  -- Create subscription order (auto-confirmed for coin)
  INSERT INTO public.subscription_orders (show_id, phone, email, payment_proof_url, payment_method, status)
  VALUES (_show_id, _phone, _email, '', 'coin', 'confirmed');

  RETURN json_build_object(
    'success', true,
    'remaining_balance', _balance - _price,
    'group_link', _show.group_link
  );
END;
$$;
