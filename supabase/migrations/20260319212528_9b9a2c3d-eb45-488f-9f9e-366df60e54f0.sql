
CREATE TABLE public.coin_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own balance" ON public.coin_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can read all balances" ON public.coin_balances FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
