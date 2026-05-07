DO $$
DECLARE _uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
    'dhy@01.com', crypt('dhatul01', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"admin"}'::jsonb,
    false, '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), _uid, jsonb_build_object('sub', _uid::text, 'email', 'dhy@01.com'), 'email', _uid::text, now(), now(), now());
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin');
END $$;