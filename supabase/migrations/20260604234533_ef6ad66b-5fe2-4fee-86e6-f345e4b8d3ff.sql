
ALTER TABLE public.jkt48_songs ALTER COLUMN setlist_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_lyric_contribution(
  _title text,
  _setlist_id uuid,
  _content text,
  _source_url text,
  _is_link_only boolean
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed boolean;
  _title_trim text;
  _song_id uuid;
  _existing_song record;
  _username text;
BEGIN
  IF _uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Harus login untuk menyumbang lirik');
  END IF;

  _title_trim := trim(coalesce(_title, ''));
  IF length(_title_trim) < 2 OR length(_title_trim) > 200 THEN
    RETURN json_build_object('success', false, 'error', 'Judul lagu 2-200 karakter');
  END IF;

  IF _is_link_only THEN
    IF coalesce(trim(_source_url), '') = '' THEN
      RETURN json_build_object('success', false, 'error', 'Mode link wajib menyertakan URL sumber');
    END IF;
  ELSE
    IF length(coalesce(_content, '')) < 20 THEN
      RETURN json_build_object('success', false, 'error', 'Isi lirik minimal 20 karakter');
    END IF;
    IF length(_content) > 20000 THEN
      RETURN json_build_object('success', false, 'error', 'Lirik terlalu panjang (maks 20.000 karakter)');
    END IF;
  END IF;

  -- Rate limit: 5 submissions / hour per user
  SELECT public.check_rate_limit('lyric_submit:' || _uid::text, 5, 3600) INTO _allowed;
  IF NOT _allowed THEN
    RETURN json_build_object('success', false, 'error', 'Terlalu banyak sumbangan. Coba lagi nanti.');
  END IF;

  -- Validate setlist if provided
  IF _setlist_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.jkt48_setlists WHERE id = _setlist_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Setlist tidak ditemukan');
  END IF;

  -- Try match existing song by exact case-insensitive title within same setlist scope
  SELECT * INTO _existing_song
  FROM public.jkt48_songs
  WHERE lower(title) = lower(_title_trim)
    AND ((_setlist_id IS NULL AND setlist_id IS NULL) OR setlist_id = _setlist_id)
  LIMIT 1;

  IF FOUND THEN
    _song_id := _existing_song.id;
  ELSE
    -- Create song as inactive; admin activates on approval
    INSERT INTO public.jkt48_songs (setlist_id, title, sort_order, is_active)
    VALUES (_setlist_id, _title_trim, 999, false)
    RETURNING id INTO _song_id;
  END IF;

  SELECT username INTO _username FROM public.profiles WHERE id = _uid;

  INSERT INTO public.jkt48_lyrics (
    song_id, content, source_url, is_link_only, external_title,
    status, contributor_user_id, contributor_name
  ) VALUES (
    _song_id,
    CASE WHEN _is_link_only THEN '' ELSE _content END,
    coalesce(_source_url, ''),
    _is_link_only,
    _title_trim,
    'pending',
    _uid,
    coalesce(_username, 'user')
  );

  RETURN json_build_object('success', true, 'message', 'Lirik dikirim. Menunggu persetujuan admin.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_lyric_contribution(text, uuid, text, text, boolean) TO authenticated;

-- When admin approves a lyric, auto-activate the related song
CREATE OR REPLACE FUNCTION public.activate_song_on_lyric_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.jkt48_songs SET is_active = true WHERE id = NEW.song_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_song_on_lyric_approve ON public.jkt48_lyrics;
CREATE TRIGGER trg_activate_song_on_lyric_approve
AFTER UPDATE ON public.jkt48_lyrics
FOR EACH ROW EXECUTE FUNCTION public.activate_song_on_lyric_approve();
