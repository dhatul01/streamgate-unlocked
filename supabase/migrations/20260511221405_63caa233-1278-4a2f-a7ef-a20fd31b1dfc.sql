DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['chat_messages','streams','playlists','tokens','site_settings'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END$$;

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.streams REPLICA IDENTITY FULL;
ALTER TABLE public.playlists REPLICA IDENTITY FULL;
ALTER TABLE public.tokens REPLICA IDENTITY FULL;
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;