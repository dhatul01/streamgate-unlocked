
-- Add image_url and text_align columns to landing_descriptions
ALTER TABLE public.landing_descriptions 
  ADD COLUMN image_url text DEFAULT '',
  ADD COLUMN text_align text NOT NULL DEFAULT 'center';
