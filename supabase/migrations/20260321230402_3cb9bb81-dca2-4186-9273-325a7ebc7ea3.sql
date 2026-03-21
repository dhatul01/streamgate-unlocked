-- Schedule automatic cleanup of rate_limits every 5 minutes
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$SELECT public.cleanup_rate_limits()$$
);

-- Schedule automatic cleanup of old OTP codes every hour
SELECT cron.schedule(
  'cleanup-old-otp-codes',
  '0 * * * *',
  $$SELECT public.cleanup_old_otp_codes()$$
);

-- Schedule automatic expiration of old coin orders every hour
SELECT cron.schedule(
  'expire-old-coin-orders',
  '0 * * * *',
  $$SELECT public.expire_old_coin_orders()$$
);