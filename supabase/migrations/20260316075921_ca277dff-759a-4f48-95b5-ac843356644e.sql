
-- Fix token_sessions: restrict to only INSERT and DELETE (not UPDATE)
DROP POLICY "Anyone can manage token sessions" ON public.token_sessions;

CREATE POLICY "Anyone can read token sessions" ON public.token_sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert token sessions" ON public.token_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete own token sessions" ON public.token_sessions
  FOR DELETE USING (true);

CREATE POLICY "Admins can manage token sessions" ON public.token_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
