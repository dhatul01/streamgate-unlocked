-- Add is_replay column to shows table for manual replay toggle
ALTER TABLE public.shows ADD COLUMN is_replay boolean NOT NULL DEFAULT false;