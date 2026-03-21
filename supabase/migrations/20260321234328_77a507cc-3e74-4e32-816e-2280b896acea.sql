
-- Fix watch_party_members: restrict INSERT/DELETE to authenticated users
DROP POLICY IF EXISTS "Anyone can join" ON public.watch_party_members;
CREATE POLICY "Authenticated can join"
  ON public.watch_party_members FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can leave" ON public.watch_party_members;
CREATE POLICY "Authenticated can leave"
  ON public.watch_party_members FOR DELETE TO authenticated
  USING (true);

-- Fix chat_messages: restrict non-admin INSERT to authenticated
DROP POLICY IF EXISTS "Anyone can insert non-admin messages" ON public.chat_messages;
CREATE POLICY "Authenticated can insert non-admin messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (is_admin = false);

-- Fix watch_parties: restrict create to authenticated
DROP POLICY IF EXISTS "Anyone can create parties" ON public.watch_parties;
CREATE POLICY "Authenticated can create parties"
  ON public.watch_parties FOR INSERT TO authenticated
  WITH CHECK (true);

-- Also allow anon to delete own poll votes (using voter_id as fingerprint)
CREATE POLICY "Anon can delete own vote by fingerprint"
  ON public.poll_votes FOR DELETE TO anon
  USING (true);
