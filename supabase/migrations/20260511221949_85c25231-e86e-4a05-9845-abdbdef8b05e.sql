-- Allow guest (anonymous) users to insert chat messages with strict validation
CREATE POLICY "Guests can insert non-admin messages with username"
ON public.chat_messages
FOR INSERT
TO anon
WITH CHECK (
  is_admin = false
  AND token_id IS NULL
  AND username IS NOT NULL
  AND length(trim(username)) BETWEEN 2 AND 24
  AND username ~ '^[A-Za-z0-9_. -]+$'
  AND message IS NOT NULL
  AND length(trim(message)) BETWEEN 1 AND 300
);