
-- Allow moderators to delete chat messages
CREATE POLICY "Moderators can delete chat messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.moderators
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow moderators to update chat messages (pin/unpin)
CREATE POLICY "Moderators can update chat messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.moderators
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow moderators to update tokens they created (block/unblock)
CREATE POLICY "Moderators can update own tokens"
ON public.tokens
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT token_id FROM public.moderator_token_logs
    WHERE moderator_id IN (
      SELECT id FROM public.moderators WHERE user_id = auth.uid() AND is_active = true
    )
  )
);

-- Allow moderators to read blocked_users
CREATE POLICY "Moderators can read blocked users"
ON public.blocked_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.moderators
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow moderators to insert blocked_users
CREATE POLICY "Moderators can block users"
ON public.blocked_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.moderators
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Allow moderators to delete blocked_users (unblock)
CREATE POLICY "Moderators can unblock users"
ON public.blocked_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.moderators
    WHERE user_id = auth.uid() AND is_active = true
  )
);
