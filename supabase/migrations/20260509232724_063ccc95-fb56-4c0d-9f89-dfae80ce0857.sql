
-- ============ IP MANAGER TABLES ============
CREATE TABLE public.blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  reason text NOT NULL DEFAULT '',
  violation_count integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  auto_blocked boolean NOT NULL DEFAULT false,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  unblocked_at timestamptz,
  unblocked_by text
);
CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip_address);
CREATE INDEX idx_blocked_ips_active ON public.blocked_ips(is_active);

CREATE TABLE public.ip_visit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  user_agent text,
  path text,
  visit_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ip_visit_log_ip ON public.ip_visit_log(ip_address);
CREATE INDEX idx_ip_visit_log_last ON public.ip_visit_log(last_seen_at DESC);

CREATE TABLE public.rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL DEFAULT '',
  violation_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rl_violations_created ON public.rate_limit_violations(created_at DESC);

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_visit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blocked_ips" ON public.blocked_ips FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage ip_visit_log" ON public.ip_visit_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage rate_limit_violations" ON public.rate_limit_violations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ VIEWER PRESENCE ============
CREATE TABLE public.viewer_presence (
  viewer_key text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_viewer_presence_seen ON public.viewer_presence(last_seen_at DESC);
ALTER TABLE public.viewer_presence ENABLE ROW LEVEL SECURITY;
-- No direct policies; access via security-definer RPCs only

CREATE OR REPLACE FUNCTION public.viewer_heartbeat(_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _key IS NULL OR length(_key) < 3 OR length(_key) > 64 THEN RETURN; END IF;
  INSERT INTO public.viewer_presence (viewer_key, last_seen_at)
  VALUES (_key, now())
  ON CONFLICT (viewer_key) DO UPDATE SET last_seen_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_viewer_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.viewer_presence
  WHERE last_seen_at > now() - interval '60 seconds';
$$;

CREATE OR REPLACE FUNCTION public.cleanup_viewer_presence()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.viewer_presence WHERE last_seen_at < now() - interval '5 minutes';
$$;

-- ============ ADMIN ADJUST COINS RPC ============
CREATE OR REPLACE FUNCTION public.admin_adjust_coins(_user_id uuid, _amount integer, _reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
  _txn_type text;
  _description text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF _amount = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Jumlah tidak boleh 0');
  END IF;

  INSERT INTO public.coin_balances (user_id, balance, updated_at)
  VALUES (_user_id, GREATEST(_amount, 0), now())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = GREATEST(public.coin_balances.balance + _amount, 0),
    updated_at = now()
  RETURNING balance INTO _new_balance;

  _txn_type := CASE WHEN _amount > 0 THEN 'admin_add' ELSE 'admin_deduct' END;
  _description := COALESCE(NULLIF(_reason, ''),
    CASE WHEN _amount > 0 THEN 'Admin menambah ' || _amount || ' koin'
         ELSE 'Admin mengurangi ' || abs(_amount) || ' koin' END);

  INSERT INTO public.coin_transactions (user_id, amount, type, description)
  VALUES (_user_id, _amount, _txn_type, _description);

  RETURN json_build_object('success', true, 'new_balance', _new_balance);
END;
$$;
