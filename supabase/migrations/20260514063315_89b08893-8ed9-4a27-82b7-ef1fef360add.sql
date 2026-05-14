
REVOKE EXECUTE ON FUNCTION public.bot_create_token(text, text, integer, boolean) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.lookup_reseller_by_phone(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.self_request_password_reset(text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.self_consume_password_reset(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_self_password_resets() FROM anon, authenticated, public;
