
-- Allow moderators to insert tokens
CREATE POLICY "Moderators can create tokens"
ON public.tokens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.moderators
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow moderators to read tokens they created (via logs)
CREATE POLICY "Moderators can read own tokens"
ON public.tokens
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT token_id FROM public.moderator_token_logs
    WHERE moderator_id IN (
      SELECT id FROM public.moderators WHERE user_id = auth.uid()
    )
  )
);
