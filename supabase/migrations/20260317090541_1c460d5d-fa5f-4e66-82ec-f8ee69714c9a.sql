ALTER TABLE public.shows ADD COLUMN category_member text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.shows.category IS 'Show category: regular, birthday, special, anniversary, last_show';
COMMENT ON COLUMN public.shows.category_member IS 'Member name for birthday or last_show categories';