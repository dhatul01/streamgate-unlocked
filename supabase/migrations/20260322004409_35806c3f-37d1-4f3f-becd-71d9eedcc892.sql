
-- Fix watch_parties INSERT: ensure host_username matches caller's profile
DROP POLICY IF EXISTS "Authenticated can create parties" ON public.watch_parties;
CREATE POLICY "Authenticated can create parties"
  ON public.watch_parties FOR INSERT
  TO authenticated
  WITH CHECK (host_username = (SELECT username FROM public.profiles WHERE id = auth.uid()));

-- Fix watch_party_members INSERT: ensure username matches caller's profile
DROP POLICY IF EXISTS "Authenticated can join" ON public.watch_party_members;
CREATE POLICY "Authenticated can join"
  ON public.watch_party_members FOR INSERT
  TO authenticated
  WITH CHECK (username = (SELECT username FROM public.profiles WHERE id = auth.uid()));
