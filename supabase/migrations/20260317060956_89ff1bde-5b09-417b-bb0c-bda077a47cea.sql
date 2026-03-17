
-- Fix: Prevent moderators from setting is_admin=true via UPDATE
DROP POLICY "Moderators can update chat messages" ON public.chat_messages;

CREATE POLICY "Moderators can update chat messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM moderators
  WHERE moderators.user_id = auth.uid() AND moderators.is_active = true
))
WITH CHECK (
  is_admin = false
);
