-- Remove moderator delete policy on chat_messages — only admins may delete
DROP POLICY IF EXISTS "Moderators can delete chat messages" ON public.chat_messages;

-- Admin manual reset: preserves pinned, returns deleted count
CREATE OR REPLACE FUNCTION public.admin_reset_chat()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  WITH del AS (
    DELETE FROM public.chat_messages WHERE is_pinned = false RETURNING 1
  )
  SELECT count(*) INTO _deleted FROM del;

  RETURN json_build_object('success', true, 'deleted', _deleted);
END;
$$;