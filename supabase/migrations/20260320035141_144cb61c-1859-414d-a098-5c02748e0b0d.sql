
-- Add short_id column to coin_orders with auto-increment style
CREATE SEQUENCE IF NOT EXISTS coin_orders_short_id_seq;

ALTER TABLE public.coin_orders ADD COLUMN IF NOT EXISTS short_id text;

-- Generate short IDs for existing orders
UPDATE public.coin_orders 
SET short_id = 'c' || nextval('coin_orders_short_id_seq')
WHERE short_id IS NULL;

-- Make short_id NOT NULL with default
ALTER TABLE public.coin_orders ALTER COLUMN short_id SET DEFAULT 'c' || nextval('coin_orders_short_id_seq');
ALTER TABLE public.coin_orders ALTER COLUMN short_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_orders_short_id ON public.coin_orders(short_id);

-- Add short_id column to subscription_orders
CREATE SEQUENCE IF NOT EXISTS subscription_orders_short_id_seq;

ALTER TABLE public.subscription_orders ADD COLUMN IF NOT EXISTS short_id text;

UPDATE public.subscription_orders 
SET short_id = 's' || nextval('subscription_orders_short_id_seq')
WHERE short_id IS NULL;

ALTER TABLE public.subscription_orders ALTER COLUMN short_id SET DEFAULT 's' || nextval('subscription_orders_short_id_seq');
ALTER TABLE public.subscription_orders ALTER COLUMN short_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_orders_short_id ON public.subscription_orders(short_id);
