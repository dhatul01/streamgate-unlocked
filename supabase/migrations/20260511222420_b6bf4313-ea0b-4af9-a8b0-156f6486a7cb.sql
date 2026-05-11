-- Ensure pg_cron is available (already installed, kept idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any older variants of this job to keep it idempotent
DO $$
DECLARE _j record;
BEGIN
  FOR _j IN SELECT jobid FROM cron.job WHERE jobname IN ('reset-chat-daily-midnight-wib','reset-global-chat-midnight') LOOP
    PERFORM cron.unschedule(_j.jobid);
  END LOOP;
END $$;

-- 17:00 UTC == 00:00 Asia/Jakarta (WIB, UTC+7)
SELECT cron.schedule(
  'reset-global-chat-midnight',
  '0 17 * * *',
  $$ SELECT public.reset_chat_daily(); $$
);