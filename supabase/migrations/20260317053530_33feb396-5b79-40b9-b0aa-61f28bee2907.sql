
-- Add is_order_closed to shows for manual order closing
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS is_order_closed boolean NOT NULL DEFAULT false;
