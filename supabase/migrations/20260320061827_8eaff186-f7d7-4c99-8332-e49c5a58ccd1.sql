
-- =============================================
-- 1. LIVE POLLS TABLE
-- =============================================
CREATE TABLE public.live_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.live_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage polls" ON public.live_polls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage polls" ON public.live_polls FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM moderators WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Anyone can read active polls" ON public.live_polls FOR SELECT TO public
  USING (is_active = true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_polls;

-- =============================================
-- 2. POLL VOTES TABLE
-- =============================================
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.live_polls(id) ON DELETE CASCADE,
  voter_id text NOT NULL,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, voter_id)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage votes" ON public.poll_votes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert vote" ON public.poll_votes FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read votes" ON public.poll_votes FOR SELECT TO public
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

-- =============================================
-- 3. REFERRAL CODES TABLE
-- =============================================
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  uses integer NOT NULL DEFAULT 0,
  reward_coins integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals" ON public.referral_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can read all referrals" ON public.referral_codes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 4. REFERRAL CLAIMS TABLE
-- =============================================
CREATE TABLE public.referral_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referral_codes(id),
  claimer_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referral_id, claimer_user_id)
);

ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read claims" ON public.referral_claims FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own claims" ON public.referral_claims FOR SELECT TO authenticated
  USING (auth.uid() = claimer_user_id);

-- =============================================
-- 5. COIN GIFTS TABLE
-- =============================================
CREATE TABLE public.coin_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_username text NOT NULL,
  sender_user_id uuid,
  amount integer NOT NULL DEFAULT 1,
  message text NOT NULL DEFAULT '',
  gift_type text NOT NULL DEFAULT 'coin',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gifts" ON public.coin_gifts FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can insert gifts" ON public.coin_gifts FOR INSERT TO public
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_gifts;

-- =============================================
-- 6. RPC: Claim referral code
-- =============================================
CREATE OR REPLACE FUNCTION public.claim_referral(_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ref record;
  _already_claimed boolean;
BEGIN
  SELECT * INTO _ref FROM public.referral_codes WHERE code = _code;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Kode referral tidak ditemukan'); END IF;
  IF _ref.user_id = auth.uid() THEN RETURN json_build_object('success', false, 'error', 'Tidak bisa klaim kode sendiri'); END IF;
  
  SELECT EXISTS(SELECT 1 FROM public.referral_claims WHERE claimer_user_id = auth.uid()) INTO _already_claimed;
  IF _already_claimed THEN RETURN json_build_object('success', false, 'error', 'Anda sudah pernah klaim referral'); END IF;

  -- Give coins to claimer
  INSERT INTO public.coin_balances (user_id, balance) VALUES (auth.uid(), _ref.reward_coins)
  ON CONFLICT (user_id) DO UPDATE SET balance = coin_balances.balance + _ref.reward_coins, updated_at = now();
  
  INSERT INTO public.coin_transactions (user_id, amount, type, description, reference_id)
  VALUES (auth.uid(), _ref.reward_coins, 'referral_bonus', 'Bonus referral dari kode ' || _code, _ref.id::text);

  -- Give coins to referrer
  INSERT INTO public.coin_balances (user_id, balance) VALUES (_ref.user_id, _ref.reward_coins)
  ON CONFLICT (user_id) DO UPDATE SET balance = coin_balances.balance + _ref.reward_coins, updated_at = now();
  
  INSERT INTO public.coin_transactions (user_id, amount, type, description, reference_id)
  VALUES (_ref.user_id, _ref.reward_coins, 'referral_reward', 'Reward referral - user baru bergabung', _ref.id::text);

  -- Record claim
  INSERT INTO public.referral_claims (referral_id, claimer_user_id) VALUES (_ref.id, auth.uid());
  UPDATE public.referral_codes SET uses = uses + 1 WHERE id = _ref.id;

  RETURN json_build_object('success', true, 'reward', _ref.reward_coins);
END;
$$;

-- =============================================
-- 7. RPC: Generate referral code for user
-- =============================================
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing record;
  _code text;
  _username text;
BEGIN
  SELECT * INTO _existing FROM public.referral_codes WHERE user_id = auth.uid();
  IF FOUND THEN RETURN json_build_object('code', _existing.code, 'uses', _existing.uses, 'reward_coins', _existing.reward_coins); END IF;

  SELECT username INTO _username FROM public.profiles WHERE id = auth.uid();
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  
  INSERT INTO public.referral_codes (user_id, code) VALUES (auth.uid(), _code);
  RETURN json_build_object('code', _code, 'uses', 0, 'reward_coins', 5);
END;
$$;

-- =============================================
-- 8. RPC: Send coin gift
-- =============================================
CREATE OR REPLACE FUNCTION public.send_coin_gift(_amount integer, _message text, _gift_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _balance integer;
  _username text;
BEGIN
  IF _amount < 1 THEN RETURN json_build_object('success', false, 'error', 'Minimum 1 koin'); END IF;
  IF _amount > 100 THEN RETURN json_build_object('success', false, 'error', 'Maksimum 100 koin per gift'); END IF;

  SELECT balance INTO _balance FROM public.coin_balances WHERE user_id = auth.uid();
  IF _balance IS NULL OR _balance < _amount THEN RETURN json_build_object('success', false, 'error', 'Koin tidak cukup'); END IF;
  
  SELECT username INTO _username FROM public.profiles WHERE id = auth.uid();

  UPDATE public.coin_balances SET balance = balance - _amount, updated_at = now() WHERE user_id = auth.uid();
  
  INSERT INTO public.coin_transactions (user_id, amount, type, description)
  VALUES (auth.uid(), -_amount, 'gift', 'Gift ' || _amount || ' koin');

  INSERT INTO public.coin_gifts (sender_username, sender_user_id, amount, message, gift_type)
  VALUES (COALESCE(_username, 'Anonymous'), auth.uid(), _amount, _message, _gift_type);

  RETURN json_build_object('success', true, 'remaining_balance', _balance - _amount);
END;
$$;
