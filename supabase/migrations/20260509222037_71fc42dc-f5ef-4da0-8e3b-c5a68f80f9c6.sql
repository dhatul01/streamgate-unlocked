CREATE OR REPLACE FUNCTION public.import_auth_user(_id uuid, _username text, _email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', _id, 'authenticated', 'authenticated',
    _email, crypt(_id::text || 'rt48imp', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', _username),
    '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), _id,
    jsonb_build_object('sub', _id::text, 'email', _email),
    'email', _id::text,
    now(), now(), now()
  ) ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.import_auth_user(uuid, text, text) FROM PUBLIC;
-- Restricted: only callable by service_role / postgres (default for SECURITY DEFINER without grant). 
-- Will be DROPPED after import.