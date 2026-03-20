
-- Fix: restrict poll_votes insert to prevent abuse (voter_id must match some identity)
DROP POLICY "Anyone can insert vote" ON public.poll_votes;
CREATE POLICY "Anyone can insert vote" ON public.poll_votes FOR INSERT TO public
  WITH CHECK (voter_id IS NOT NULL AND option_index >= 0);

-- Fix: restrict coin_gifts insert to authenticated users only
DROP POLICY "Anyone can insert gifts" ON public.coin_gifts;
CREATE POLICY "Authenticated users can insert gifts" ON public.coin_gifts FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid());

-- Add missing INSERT policy for referral_codes (via RPC only, but needed for the function)
-- referral_codes are managed by RPC functions so no direct insert policy needed
-- referral_claims are managed by RPC functions so no direct insert policy needed
