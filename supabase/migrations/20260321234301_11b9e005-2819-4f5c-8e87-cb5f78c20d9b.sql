
-- Fix poll_votes: remove permissive DELETE, add scoped policies
DROP POLICY IF EXISTS "Anyone can delete own vote" ON public.poll_votes;
CREATE POLICY "Authenticated can delete own vote"
  ON public.poll_votes FOR DELETE TO authenticated
  USING (voter_id = auth.uid()::text);

-- Fix security_events: remove policy exposing IPs to all users
DROP POLICY IF EXISTS "Users can read critical alerts" ON public.security_events;

-- Fix watch_parties: remove broken update policy
DROP POLICY IF EXISTS "Host can update own party" ON public.watch_parties;
