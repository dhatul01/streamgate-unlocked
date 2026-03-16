
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.chat_messages
  WHERE created_at < (now() - interval '30 minutes')
    AND is_pinned = false;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cleanup_old_chat_messages
AFTER INSERT ON public.chat_messages
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_chat_messages();
