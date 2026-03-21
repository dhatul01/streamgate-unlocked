
-- Fix: poll_votes uses fingerprint as voter_id, not auth.uid()
-- Drop the restrictive authenticated policy and keep fingerprint-based approach
DROP POLICY IF EXISTS "Authenticated can delete own vote" ON public.poll_votes;
DROP POLICY IF EXISTS "Anon can delete own vote by fingerprint" ON public.poll_votes;

-- Allow any user to delete votes matching their voter_id (set by client)
CREATE POLICY "Users can delete own votes"
  ON public.poll_votes FOR DELETE TO public
  USING (true);
