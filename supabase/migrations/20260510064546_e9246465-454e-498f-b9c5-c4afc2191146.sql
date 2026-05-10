CREATE OR REPLACE FUNCTION public.check_ip_banned(_ip text)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT json_build_object(
      'banned', true,
      'reason', reason,
      'blocked_at', blocked_at,
      'auto', auto_blocked
    ) FROM public.blocked_ips
     WHERE ip_address = _ip AND is_active = true
     ORDER BY blocked_at DESC LIMIT 1),
    json_build_object('banned', false)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_ip_banned(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_ip_visit(_ip text, _ua text, _path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _ip IS NULL OR length(_ip) < 3 THEN RETURN; END IF;
  INSERT INTO public.ip_visit_log (ip_address, user_agent, path, visit_count, first_seen_at, last_seen_at)
  VALUES (_ip, _ua, _path, 1, now(), now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_ip_visit(text, text, text) TO anon, authenticated;