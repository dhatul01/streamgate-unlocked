
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.chat_messages
  WHERE id IN (
    SELECT id FROM public.chat_messages
    WHERE is_pinned = false
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cleanup_old_chat ON public.chat_messages;
CREATE TRIGGER trg_cleanup_old_chat
  AFTER INSERT ON public.chat_messages
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_chat_messages();
