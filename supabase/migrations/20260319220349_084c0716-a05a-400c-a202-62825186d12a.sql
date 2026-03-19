
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cleanup_old_otp_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.otp_codes WHERE expires_at < now() - interval '1 hour';
$$;
