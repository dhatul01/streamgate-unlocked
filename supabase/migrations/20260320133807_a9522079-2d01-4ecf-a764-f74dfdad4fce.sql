CREATE OR REPLACE FUNCTION public.get_my_active_show_tokens()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '{}'::json;
  END IF;

  SELECT COALESCE(json_object_agg(t.show_id::text, t.code), '{}'::json)
  INTO _result
  FROM (
    SELECT DISTINCT ON (show_id) show_id, code
    FROM public.tokens
    WHERE buyer_user_id = auth.uid()
      AND show_id IS NOT NULL
      AND status = 'active'
      AND expires_at > now()
    ORDER BY show_id, created_at DESC
  ) t;

  RETURN COALESCE(_result, '{}'::json);
END;
$function$;