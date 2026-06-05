import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const rawUrl: string = String(body?.url || '').trim();
    if (!rawUrl) return json({ error: 'url required' }, 400);

    let parsed: URL;
    try { parsed = new URL(rawUrl); } catch {
      return json({ error: 'invalid url' }, 400);
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return json({ error: 'only http(s) allowed' }, 400);
    }
    if (!ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) {
      return json({
        error: 'host_not_allowed',
        message: `Domain ${parsed.hostname} belum diizinkan. Hubungi developer untuk menambah ke allow-list.`,
        allowed: ALLOWED_HOSTS,
      }, 400);
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let html = '';
    let fetchStatus = 0;
    try {
      const res = await fetch(parsed.toString(), {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity',
        },
      });
      fetchStatus = res.status;
      const buf = await res.arrayBuffer();
      html = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 250_000));
    } catch (e) {
      clearTimeout(timer);
      // Return 200 supaya UI bisa fallback ke input manual tanpa toast "non-2xx".
      return json({ success: false, error: 'fetch_failed', message: String((e as Error).message), url: parsed.toString() });
    }
    clearTimeout(timer);
    if (!html || fetchStatus >= 400) {
      return json({ success: false, error: 'fetch_blocked', status: fetchStatus, url: parsed.toString(), message: `Situs sumber menolak permintaan (status ${fetchStatus}). Silakan isi judul manual.` });
    }

    const pick = (re: RegExp) => {
      const m = html.match(re);
      return m ? decodeEntities(m[1]).trim() : '';
    };
    const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const titleTag = pick(/<title[^>]*>([^<]+)<\/title>/i);
    const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const siteName = pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);

    let title = ogTitle || titleTag;
    title = title.replace(/\s*[\|–-]\s*(Genius Lyrics|Genius|JKT48 Official Website|Lirik Lagu.*|Kapanlagi.*|Musixmatch).*$/i, '').trim();
    let artist = '';
    let song = title;
    const dashMatch = title.match(/^(.+?)\s*[–-]\s*(.+)$/);
    if (dashMatch) {
      artist = dashMatch[1].trim();
      song = dashMatch[2].replace(/\s*Lyrics?\s*$/i, '').trim();
    } else {
      song = song.replace(/\s*Lyrics?\s*$/i, '').trim();
    }

    return json({
      success: true,
      url: parsed.toString(),
      host: parsed.hostname,
      title,
      song_guess: song,
      artist_guess: artist,
      description: ogDesc.slice(0, 300),
      site_name: siteName,
      note: 'Hanya metadata judul yang diambil.',
    });
  } catch (e) {
    return json({ error: 'server_error', message: String((e as Error).message) }, 500);
  }
});
