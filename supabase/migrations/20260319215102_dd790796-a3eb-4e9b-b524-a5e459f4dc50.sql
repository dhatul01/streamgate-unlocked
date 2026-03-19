
-- Admin notifications table
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins/moderators can read
CREATE POLICY "Admins can manage notifications" ON public.admin_notifications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can read notifications" ON public.admin_notifications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM moderators WHERE user_id = auth.uid() AND is_active = true));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- Trigger: auto-create notification on coin redemption
CREATE OR REPLACE FUNCTION public.notify_coin_redemption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE _username text;
BEGIN
  IF NEW.type = 'redeem' THEN
    SELECT username INTO _username FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.admin_notifications (title, message, type)
    VALUES (
      '🪙 Pembelian Show dengan Koin',
      COALESCE(_username, 'User') || ' menukar ' || abs(NEW.amount) || ' koin — ' || COALESCE(NEW.description, ''),
      'coin_redeem'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_coin_redemption
  AFTER INSERT ON public.coin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_coin_redemption();
