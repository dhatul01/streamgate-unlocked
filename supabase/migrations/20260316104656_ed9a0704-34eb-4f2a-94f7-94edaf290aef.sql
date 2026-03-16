-- Replace overly permissive INSERT policy on subscription_orders
DROP POLICY IF EXISTS "Anyone can submit orders" ON public.subscription_orders;

-- New policy: anyone can submit orders but only with pending status and valid show_id
CREATE POLICY "Anyone can submit orders"
ON public.subscription_orders
FOR INSERT
TO public
WITH CHECK (
  status = 'pending'
  AND show_id IS NOT NULL
);