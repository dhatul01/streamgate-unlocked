
-- Create a secure RPC that returns public show data WITHOUT group_link
CREATE OR REPLACE FUNCTION public.get_public_shows()
RETURNS TABLE (
  id uuid,
  title text,
  price text,
  lineup text,
  schedule_date text,
  schedule_time text,
  background_image_url text,
  qris_image_url text,
  sort_order integer,
  is_active boolean,
  is_subscription boolean,
  max_subscribers integer,
  subscription_benefits text,
  is_order_closed boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id, s.title, s.price, s.lineup, s.schedule_date, s.schedule_time,
    s.background_image_url, s.qris_image_url, s.sort_order, s.is_active,
    s.is_subscription, s.max_subscribers, s.subscription_benefits,
    s.is_order_closed, s.created_at
  FROM public.shows s
  WHERE s.is_active = true
  ORDER BY s.sort_order;
$$;

-- Remove the public SELECT policy that exposes group_link
DROP POLICY "Anyone can read active shows" ON public.shows;
