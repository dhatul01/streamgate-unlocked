
-- Fix: prevent anonymous users from impersonating admins
DROP POLICY "Anyone can insert chat messages" ON public.chat_messages;

CREATE POLICY "Anyone can insert non-admin messages" ON public.chat_messages
  FOR INSERT WITH CHECK (is_admin = false);
