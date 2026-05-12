
-- 1) Add RLS policies for tables that have RLS enabled but no policies
-- rate_limits, session_resets, viewer_presence: only admins can read/manage directly
-- (SECURITY DEFINER functions bypass RLS so app logic continues to work)

CREATE POLICY "Admins manage rate_limits" ON public.rate_limits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage session_resets" ON public.session_resets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage viewer_presence" ON public.viewer_presence
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated/public,
-- then GRANT back only what each role legitimately needs.

-- Helper macro pattern (repeated explicitly because Postgres has no batch revoke by attribute)

-- Internal/trigger/cron functions: no client should call these
REVOKE EXECUTE ON FUNCTION public.cleanup_old_otp_codes()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_chat_messages()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_chat_daily()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_viewer_presence()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_coin_orders()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_rate_limit_abuse()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_coin_redemption()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_auth_user(uuid, text, text)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ip_visit(text, text, text)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.obfuscate_url(text)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parse_show_datetime(text, text)            FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs (also enforced inside the function body)
REVOKE EXECUTE ON FUNCTION public.admin_reset_chat()                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_coins(uuid, integer, text)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_coin_order(uuid)                        FROM PUBLIC, anon;

-- Authenticated-only RPCs (revoke anon access)
REVOKE EXECUTE ON FUNCTION public.redeem_coins_for_replay(uuid)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_coins_for_token(uuid)                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_coins_for_membership(uuid, text, text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_coin_gift(integer, text, text)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_referral(text)                            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_referral_code()                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_active_show_tokens()                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_password_reset_status()                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_purchased_show_passwords()                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.moderator_create_token(text, text, timestamptz, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                        FROM PUBLIC, anon;

-- Public RPCs (anon + authenticated): explicit grant for clarity
GRANT EXECUTE ON FUNCTION public.validate_token(text)                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_token_session(text, text, text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_token_session(text, text)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_reset_token_session(text, text)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.viewer_heartbeat(text)                         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_viewer_count()                             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_shows()                             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_playlists_for_token(text)                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_playlists_for_channel(text)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_moderator_playlists(text)                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ip_banned(text)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_password_reset(text)                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_password_reset(text, text)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_count(uuid)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_confirmed_order_count(uuid)                TO anon, authenticated;
