
-- Indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_token_sessions_token_id ON public.token_sessions(token_id);
CREATE INDEX IF NOT EXISTS idx_token_sessions_token_fp ON public.token_sessions(token_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_tokens_show_id ON public.tokens(show_id) WHERE show_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_status_expires ON public.tokens(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);

-- Schedule recurring cleanup (idempotent via unschedule)
DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-viewer-presence-5m');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-rate-limits-1h');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('cleanup-viewer-presence-5m', '*/5 * * * *', $$SELECT public.cleanup_viewer_presence();$$);
SELECT cron.schedule('cleanup-rate-limits-1h', '0 * * * *', $$SELECT public.cleanup_rate_limits();$$);
