
-- Table for Pakasir payment orders
CREATE TABLE public.pakasir_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  show_id uuid NOT NULL,
  phone text NOT NULL,
  email text NOT NULL DEFAULT '',
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  qr_string text NOT NULL DEFAULT '',
  expires_at timestamptz,
  token_id uuid,
  token_code text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pakasir_orders_order_id ON public.pakasir_orders(order_id);
CREATE INDEX idx_pakasir_orders_status ON public.pakasir_orders(status);
CREATE INDEX idx_pakasir_orders_show ON public.pakasir_orders(show_id);

ALTER TABLE public.pakasir_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pakasir orders" ON public.pakasir_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Create order: callable from edge function (service role)
CREATE OR REPLACE FUNCTION public.create_pakasir_order(
  _show_id uuid, _phone text, _email text, _amount integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _order_id text;
  _show_active boolean;
BEGIN
  IF _phone IS NULL OR length(regexp_replace(_phone, '[^0-9]', '', 'g')) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Nomor HP tidak valid');
  END IF;
  IF _amount IS NULL OR _amount < 100 THEN
    RETURN json_build_object('success', false, 'error', 'Jumlah tidak valid');
  END IF;

  SELECT is_active INTO _show_active FROM public.shows WHERE id = _show_id;
  IF NOT FOUND OR NOT _show_active THEN
    RETURN json_build_object('success', false, 'error', 'Show tidak tersedia');
  END IF;

  _order_id := 'RT48-' || to_char(now(), 'YYMMDDHH24MISS') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.pakasir_orders (order_id, show_id, phone, email, amount, status)
  VALUES (_order_id, _show_id, regexp_replace(_phone, '[^0-9]', '', 'g'),
          COALESCE(_email, ''), _amount, 'pending');

  RETURN json_build_object('success', true, 'order_id', _order_id);
END;
$$;

-- Update QR string after Pakasir API call
CREATE OR REPLACE FUNCTION public.set_pakasir_qr(
  _order_id text, _qr_string text, _expires_at timestamptz
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.pakasir_orders
  SET qr_string = _qr_string, expires_at = _expires_at
  WHERE order_id = _order_id AND status = 'pending';
  RETURN json_build_object('success', FOUND);
END;
$$;

-- Webhook: complete order, create token
CREATE OR REPLACE FUNCTION public.complete_pakasir_order(
  _order_id text, _amount integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _order record;
  _show record;
  _token_code text;
  _token_id uuid;
  _expires timestamptz;
  _show_start timestamptz;
  _replay_expires timestamptz;
BEGIN
  SELECT * INTO _order FROM public.pakasir_orders WHERE order_id = _order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF _order.status = 'completed' AND _order.token_code IS NOT NULL THEN
    -- Idempotent
    SELECT * INTO _show FROM public.shows WHERE id = _order.show_id;
    RETURN json_build_object('success', true, 'idempotent', true,
      'token_code', _order.token_code, 'phone', _order.phone,
      'show_title', _show.title, 'show_id', _show.id,
      'replay_expires_at', (SELECT replay_expires_at FROM public.tokens WHERE id = _order.token_id),
      'expires_at', (SELECT expires_at FROM public.tokens WHERE id = _order.token_id),
      'access_password', _show.access_password);
  END IF;

  IF _amount IS NOT NULL AND _amount <> _order.amount THEN
    RETURN json_build_object('success', false, 'error', 'Amount mismatch');
  END IF;

  SELECT * INTO _show FROM public.shows WHERE id = _order.show_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Show not found');
  END IF;

  _show_start := public.parse_show_datetime(_show.schedule_date, _show.schedule_time);
  IF _show_start IS NOT NULL THEN
    _expires := _show_start + interval '4 hours';
    IF _expires < now() THEN _expires := now() + interval '4 hours'; END IF;
  ELSE
    _expires := now() + interval '1 day';
  END IF;
  _replay_expires := _expires + interval '14 days';

  _token_code := 'PKS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.tokens (
    code, duration_type, expires_at, max_devices, is_public, status,
    replay_password, show_id, replay_expires_at
  ) VALUES (
    _token_code, 'show', _expires, 1, false, 'active',
    _show.access_password, _show.id, _replay_expires
  ) RETURNING id INTO _token_id;

  UPDATE public.pakasir_orders
  SET status = 'completed', completed_at = now(),
      token_id = _token_id, token_code = _token_code
  WHERE id = _order.id;

  INSERT INTO public.admin_notifications (title, message, type)
  VALUES ('💳 Pembayaran Pakasir Diterima',
    'Order ' || _order.order_id || ' (' || _show.title || ') untuk ' || _order.phone
    || ' — token ' || _token_code || ' telah dibuat',
    'pakasir');

  RETURN json_build_object(
    'success', true,
    'token_code', _token_code,
    'token_id', _token_id,
    'expires_at', _expires,
    'replay_expires_at', _replay_expires,
    'phone', _order.phone,
    'show_title', _show.title,
    'show_id', _show.id,
    'access_password', _show.access_password
  );
END;
$$;

-- Public status check
CREATE OR REPLACE FUNCTION public.get_pakasir_order_status(_order_id text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'status', status,
    'token_code', token_code,
    'amount', amount,
    'show_id', show_id
  )
  FROM public.pakasir_orders WHERE order_id = _order_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_pakasir_order_status(text) TO anon, authenticated;
