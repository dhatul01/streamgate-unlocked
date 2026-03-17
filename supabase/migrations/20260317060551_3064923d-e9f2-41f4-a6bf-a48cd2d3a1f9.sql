
-- Fix 1: Tighten subscription_orders INSERT to require valid payment_proof_url
DROP POLICY "Anyone can submit orders" ON public.subscription_orders;

CREATE POLICY "Anyone can submit orders"
ON public.subscription_orders
FOR INSERT
TO public
WITH CHECK (
  status = 'pending'
  AND show_id IS NOT NULL
  AND payment_proof_url <> ''
  AND phone <> ''
  AND email <> ''
);

-- Fix 2: Remove anon SELECT policy that leaks moderator streaming URLs
DROP POLICY "Public can read moderator playlists" ON public.moderator_playlists;
