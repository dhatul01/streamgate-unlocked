
-- Moderators table: stores moderator profile and site customization
CREATE TABLE public.moderators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  site_name text NOT NULL DEFAULT 'My Channel',
  logo_url text,
  background_color text NOT NULL DEFAULT '#1a1a2e',
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id)
);

ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage moderators" ON public.moderators
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Moderators can read and update their own profile
CREATE POLICY "Moderators can read own profile" ON public.moderators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Moderators can update own profile" ON public.moderators
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Moderator token log: tracks tokens created by moderators
CREATE TABLE public.moderator_token_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid NOT NULL REFERENCES public.moderators(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderator_token_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage token logs" ON public.moderator_token_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can read own token logs" ON public.moderator_token_logs
  FOR SELECT TO authenticated
  USING (moderator_id IN (SELECT id FROM public.moderators WHERE user_id = auth.uid()));

CREATE POLICY "Moderators can insert own token logs" ON public.moderator_token_logs
  FOR INSERT TO authenticated
  WITH CHECK (moderator_id IN (SELECT id FROM public.moderators WHERE user_id = auth.uid()));

-- Public can read moderator profiles (for channel pages)
CREATE POLICY "Public can read active moderators" ON public.moderators
  FOR SELECT TO anon
  USING (is_active = true);
