
-- New function to count all non-rejected orders (pending + confirmed) for capacity tracking
CREATE OR REPLACE FUNCTION public.get_order_count(_show_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT count(*)::integer
  FROM public.subscription_orders
  WHERE show_id = _show_id AND status IN ('pending', 'confirmed')
$$;
