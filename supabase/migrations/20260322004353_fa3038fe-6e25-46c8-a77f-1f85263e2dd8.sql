
-- Fix poll_votes DELETE: only allow deleting own votes
DROP POLICY IF EXISTS "Users can delete own votes" ON public.poll_votes;
CREATE POLICY "Users can delete own votes"
  ON public.poll_votes FOR DELETE
  TO public
  USING (voter_id = coalesce(auth.uid()::text, ''));

-- Fix watch_party_members DELETE: only allow removing yourself
DROP POLICY IF EXISTS "Authenticated can leave" ON public.watch_party_members;
CREATE POLICY "Authenticated can leave"
  ON public.watch_party_members FOR DELETE
  TO authenticated
  USING (username = (SELECT username FROM public.profiles WHERE id = auth.uid()));
