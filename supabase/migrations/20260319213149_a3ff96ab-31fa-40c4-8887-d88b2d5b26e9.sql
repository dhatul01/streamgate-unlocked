
DROP FUNCTION IF EXISTS public.get_public_shows();

CREATE FUNCTION public.get_public_shows()
RETURNS SETOF public.shows
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.shows s
  WHERE s.is_active = true
  ORDER BY s.sort_order;
$$;
