
-- Table to store chat moderator usernames (not Supabase auth users, just viewer usernames)
CREATE TABLE public.chat_moderators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  appointed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_moderators ENABLE ROW LEVEL SECURITY;

-- Only admins and system moderators can manage chat moderators
CREATE POLICY "Admins can manage chat moderators"
ON public.chat_moderators
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage chat moderators"
ON public.chat_moderators
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.moderators WHERE user_id = auth.uid() AND is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.moderators WHERE user_id = auth.uid() AND is_active = true));

-- Anyone can read chat moderators (needed for badge display)
CREATE POLICY "Anyone can read chat moderators"
ON public.chat_moderators
FOR SELECT
TO public
USING (true);

-- Enable realtime for chat_moderators
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_moderators;
