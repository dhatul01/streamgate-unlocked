
-- Moderators can manage streams (live control)
CREATE POLICY "Moderators can manage streams"
ON public.streams FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true));

-- Moderators can manage playlists
CREATE POLICY "Moderators can manage playlists"
ON public.playlists FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true));

-- Moderators can manage site settings
CREATE POLICY "Moderators can manage site settings"
ON public.site_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true));

-- Moderators can manage shows
CREATE POLICY "Moderators can manage shows"
ON public.shows FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true));

-- Moderators can manage subscription orders
CREATE POLICY "Moderators can manage orders"
ON public.subscription_orders FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true));

-- Moderators can manage token sessions
CREATE POLICY "Moderators can manage token sessions"
ON public.token_sessions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true));

-- Moderators can manage landing descriptions
CREATE POLICY "Moderators can manage descriptions"
ON public.landing_descriptions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true));

-- Moderators can manage ALL tokens (not just own)
CREATE POLICY "Moderators can manage all tokens"
ON public.tokens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM moderators WHERE moderators.user_id = auth.uid() AND moderators.is_active = true));
