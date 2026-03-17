
-- Enable realtime for shows table so anonymous users get updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.shows;

-- Enable realtime for subscription_orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_orders;

-- Allow anonymous users to read active shows (needed for realtime)
CREATE POLICY "Anyone can read active shows"
ON public.shows
FOR SELECT
TO anon, authenticated
USING (is_active = true);
