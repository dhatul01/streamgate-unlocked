CREATE OR REPLACE FUNCTION public.get_public_shows()
 RETURNS SETOF shows
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT s.id, s.title, s.price, s.lineup, s.schedule_date, s.schedule_time, 
         s.background_image_url, s.qris_image_url, s.sort_order, s.is_active,
         s.created_at, s.is_subscription, s.max_subscribers, s.subscription_benefits, 
         s.group_link, s.is_order_closed, s.category, s.category_member, s.coin_price,
         ''::text as access_password, s.replay_coin_price, s.is_replay
  FROM public.shows s
  WHERE s.is_active = true
  ORDER BY s.sort_order;
$$;