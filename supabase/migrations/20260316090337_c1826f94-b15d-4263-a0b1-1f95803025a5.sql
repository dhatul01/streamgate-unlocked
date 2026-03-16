
-- Add subscription fields to shows
ALTER TABLE public.shows ADD COLUMN is_subscription boolean NOT NULL DEFAULT false;
ALTER TABLE public.shows ADD COLUMN max_subscribers integer NOT NULL DEFAULT 0;
ALTER TABLE public.shows ADD COLUMN subscription_benefits text NOT NULL DEFAULT '';
ALTER TABLE public.shows ADD COLUMN group_link text NOT NULL DEFAULT '';

-- Subscription orders table
CREATE TABLE public.subscription_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  payment_proof_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit orders" ON public.subscription_orders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can read orders" ON public.subscription_orders FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage orders" ON public.subscription_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Landing descriptions
CREATE TABLE public.landing_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '✨',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active descriptions" ON public.landing_descriptions FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Admins can manage descriptions" ON public.landing_descriptions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Payment proofs storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true);

CREATE POLICY "Anyone can upload payment proofs" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'payment-proofs');
CREATE POLICY "Anyone can view payment proofs" ON storage.objects FOR SELECT TO public USING (bucket_id = 'payment-proofs');
CREATE POLICY "Admins can delete payment proofs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-proofs' AND has_role(auth.uid(), 'admin'));
