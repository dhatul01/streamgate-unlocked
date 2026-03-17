ALTER TABLE public.shows ADD COLUMN category text NOT NULL DEFAULT 'regular';

COMMENT ON COLUMN public.shows.category IS 'Show category: regular, birthday, special, anniversary';