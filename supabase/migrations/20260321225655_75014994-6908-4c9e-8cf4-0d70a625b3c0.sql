DROP POLICY IF EXISTS "Anyone can delete own vote" ON public.poll_votes;
CREATE POLICY "Anyone can delete own vote"
ON public.poll_votes
FOR DELETE
TO public
USING (true);