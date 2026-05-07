
-- Update cleanup function to keep only 30 messages
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.chat_messages
  WHERE id IN (
    SELECT id FROM public.chat_messages
    WHERE is_pinned = false
    ORDER BY created_at DESC
    OFFSET 30
  );
  RETURN NEW;
END;
$$;

-- Drop duplicate trigger, keep one
DROP TRIGGER IF EXISTS trigger_cleanup_old_chat_messages ON public.chat_messages;

-- Daily reset function (called by cron at 00:00 Asia/Jakarta = 17:00 UTC)
CREATE OR REPLACE FUNCTION public.reset_chat_daily()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.chat_messages WHERE is_pinned = false;
$$;
