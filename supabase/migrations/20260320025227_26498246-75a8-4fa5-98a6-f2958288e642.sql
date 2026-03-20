
-- Singleton table to track getUpdates offset
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the single row
INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

-- Enable RLS (only service_role should access)
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bot state"
ON public.telegram_bot_state
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Table for storing incoming Telegram messages
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  text text,
  raw_update jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);
CREATE INDEX idx_telegram_messages_processed ON public.telegram_messages (processed) WHERE processed = false;

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage telegram messages"
ON public.telegram_messages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
