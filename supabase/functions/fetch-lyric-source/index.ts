import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_HOSTS = [
  'genius.com', 'www.genius.com',
  'jkt48.com', 'www.jkt48.com',
  'lirik.kapanlagi.com',
  'lyricstranslate.com', 'www.lyricstranslate.com',
  'musixmatch.com', 'www.musixmatch.com',
  'lirik.net', 'www.lirik.net',
  'jkt48fanmade.com', 'www.jkt48fanmade.com',
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Require admin
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json().catch(() => ({}));
    const rawUrl: string = String(body?.url || '').trim();
    if (!rawUrl) return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let parsed: URL;
    try { parsed = new URL(rawUrl); } catch {
      return new Response(JSON.stringify({ error: 'invalid url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return new Response(JSON.stringify({ error: 'only http(s) allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) {
      return new Response(JSON.stringify({
        error: 'host_not_allowed',
        message: `Domain ${parsed.hostname} belum diizinkan. Hubungi developer untuk menambah ke allow-list.`,
        allowed: ALLOWED_HOSTS,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch the page (HEAD-ish: limit body to ~200KB by aborting early)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let html = '';
    try {
      const res = await fetch(parsed.toString(), {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 LovableLyricMeta/1.0', 'Accept': 'text/html' },
      });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buf = await res.arrayBuffer();
      html = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 200_000));
    } catch (e) {
      clearTimeout(timer);
      return new Response(JSON.stringify({ error: 'fetch_failed', message: String((e as Error).message) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    clearTimeout(timer);

    // Extract metadata only — title, og:title, artist hints. We deliberately DO NOT extract lyric body.
    const pick = (re: RegExp) => {
      const m = html.match(re);
      return m ? decodeEntities(m[1]).trim() : '';
    };
    const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const titleTag = pick(/<title[^>]*>([^<]+)<\/title>/i);
    const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const siteName = pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);

    let title = ogTitle || titleTag;
    // Strip common site suffixes
    title = title.replace(/\s*[\|–-]\s*(Genius Lyrics|Genius|JKT48 Official Website|Lirik Lagu.*|Kapanlagi.*|Musixmatch).*$/i, '').trim();
    // Try to extract artist + song
    let artist = '';
    let song = title;
    const dashMatch = title.match(/^(.+?)\s*[–-]\s*(.+)$/);
    if (dashMatch) {
      // Genius often: "Artist – Song Lyrics"
      artist = dashMatch[1].trim();
      song = dashMatch[2].replace(/\s*Lyrics?\s*$/i, '').trim();
    } else {
      song = song.replace(/\s*Lyrics?\s*$/i, '').trim();
    }

    return new Response(JSON.stringify({
      success: true,
      url: parsed.toString(),
      host: parsed.hostname,
      title,
      song_guess: song,
      artist_guess: artist,
      description: ogDesc.slice(0, 300),
      site_name: siteName,
      note: 'Hanya metadata judul yang diambil. Isi lirik harus ditempel manual atau simpan sebagai link-only untuk menghindari masalah hak cipta.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error', message: String((e as Error).message) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
