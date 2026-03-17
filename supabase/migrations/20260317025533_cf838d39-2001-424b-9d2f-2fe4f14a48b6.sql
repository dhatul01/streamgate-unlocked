
-- Create function for channel pages to get playlists (verified by active moderator username)
CREATE OR REPLACE FUNCTION public.get_playlists_for_channel(_moderator_username text)
RETURNS SETOF public.playlists
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify moderator exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.moderators 
    WHERE username = _moderator_username AND is_active = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.playlists ORDER BY sort_order;
END;
$function$;
