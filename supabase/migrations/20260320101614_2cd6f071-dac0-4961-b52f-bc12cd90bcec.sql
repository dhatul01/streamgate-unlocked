
CREATE OR REPLACE FUNCTION public.get_my_password_reset_status()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('has_reset', false); END IF;

  SELECT id, status, processed_at INTO _result
  FROM public.password_reset_requests
  WHERE user_id = auth.uid()
    AND status IN ('approved', 'completed')
    AND processed_at IS NOT NULL
    AND processed_at > now() - interval '24 hours'
  ORDER BY processed_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN json_build_object('has_reset', false); END IF;

  RETURN json_build_object(
    'has_reset', true,
    'status', _result.status,
    'processed_at', _result.processed_at
  );
END;
$function$;
