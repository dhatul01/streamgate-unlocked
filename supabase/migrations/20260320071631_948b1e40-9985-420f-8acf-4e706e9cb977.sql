
-- Enable pg_cron and pg_net for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table to track sent reminders (prevent duplicates)
CREATE TABLE public.show_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT '1h',
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(show_id, reminder_type)
);

ALTER TABLE public.show_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reminders" ON public.show_reminders_sent
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
