
-- Remove the public SELECT policy that exposes access_password and group_link
DROP POLICY IF EXISTS "Anyone can read active shows" ON public.shows;
