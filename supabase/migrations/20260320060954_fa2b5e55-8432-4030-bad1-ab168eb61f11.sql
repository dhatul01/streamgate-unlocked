
CREATE OR REPLACE FUNCTION public.get_purchased_show_passwords()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result json;
BEGIN
  -- Get access_password for shows the user has purchased via coin redemption (both live and replay)
  SELECT json_object_agg(s.id::text, s.access_password) INTO _result
  FROM public.shows s
  WHERE s.is_active = true
    AND s.access_password != ''
    AND s.id::text IN (
      SELECT DISTINCT ct.reference_id 
      FROM public.coin_transactions ct 
      WHERE ct.user_id = auth.uid() 
        AND ct.type IN ('redeem', 'replay_redeem')
        AND ct.reference_id IS NOT NULL
    );
  
  RETURN COALESCE(_result, '{}'::json);
END;
$function$;
