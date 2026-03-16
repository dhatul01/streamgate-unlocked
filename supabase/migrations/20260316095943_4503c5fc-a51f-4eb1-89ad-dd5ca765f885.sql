CREATE OR REPLACE FUNCTION public.get_confirmed_order_count(_show_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.subscription_orders
  WHERE show_id = _show_id AND status = 'confirmed'
$$;