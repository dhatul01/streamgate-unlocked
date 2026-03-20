
-- 1. Add access_password column to shows table
ALTER TABLE public.shows ADD COLUMN access_password text NOT NULL DEFAULT '';

-- 2. Create function to auto-expire pending coin orders older than 24 hours
CREATE OR REPLACE FUNCTION public.expire_old_coin_orders()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.coin_orders
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < now() - interval '24 hours';
$$;

-- 3. Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
