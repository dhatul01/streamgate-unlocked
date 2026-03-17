import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNING_SECRET = SERVICE_ROLE_KEY;

// Token validity (seconds)
const PLAYLIST_TOKEN_TTL = 300; // 5 minutes
const SUB_PLAYLIST_TOKEN_TTL = 600; // 10 minutes for sub-playlists

// --- Crypto helpers ---
async function hmacSign(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmacVerify(message: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(message);
  return expected === signature;
}

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
}

// --- URL helpers ---
function resolveUrl(url: string, base: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return new URL(url, base).href;
  } catch {
    const basePath = base.substring(0, base.lastIndexOf("/") + 1);
    return basePath + url;
  }
}

function getBaseUrl(url: string): string {
  return url.substring(0, url.lastIndexOf("/") + 1);
}

function isM3u8Url(url: string, contentType?: string): boolean {
  return (
    url.endsWith(".m3u8") ||
    url.includes(".m3u8?") ||
    (contentType || "").includes("mpegurl") ||
    (contentType || "").includes("x-mpegURL")
  );
}

// --- Signed URL generators ---
async function generatePlaylistSignedUrl(
  playlistId: string,
  functionUrl: string,
  ttl: number = PLAYLIST_TOKEN_TTL
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const message = `playlist:${playlistId}:${exp}`;
  const sig = await hmacSign(message);
  return `${functionUrl}/stream-proxy?mode=play&pid=${playlistId}&exp=${exp}&sig=${sig}`;
}

async function generateSubPlaylistSignedUrl(
  rawUrl: string,
  functionUrl: string,
  ttl: number = SUB_PLAYLIST_TOKEN_TTL
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const encoded = base64UrlEncode(rawUrl);
  const message = `sub:${encoded}:${exp}`;
  const sig = await hmacSign(message);
  return `${functionUrl}/stream-proxy?mode=sub&u=${encoded}&exp=${exp}&sig=${sig}`;
}

// --- HYBRID m3u8 rewriter ---
// Only rewrites lines that point to OTHER .m3u8 files (sub-playlists).
// Segment URLs (.ts, .mp4, .aac, etc.) are resolved to absolute CDN URLs
// and left UNTOUCHED so the player fetches them directly from CDN.
async function rewriteM3u8Hybrid(
  content: string,
  baseUrl: string,
  functionUrl: string
): Promise<string> {
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty lines pass through
    if (!trimmed) {
      result.push(line);
      continue;
    }

    // Tag lines: check for URI= references (e.g., EXT-X-MAP, EXT-X-KEY)
    if (trimmed.startsWith("#")) {
      if (trimmed.includes('URI="')) {
        const rewritten = await rewriteUriInTag(trimmed, baseUrl, functionUrl);
        result.push(rewritten);
      } else {
        result.push(line);
      }
      continue;
    }

    // URL line — determine if it's a sub-playlist (.m3u8) or a segment (.ts etc.)
    const absoluteUrl = resolveUrl(trimmed, baseUrl);

    if (isM3u8Url(absoluteUrl)) {
      // Sub-playlist → proxy through our function (small file, ~1-5KB)
      const signedUrl = await generateSubPlaylistSignedUrl(absoluteUrl, functionUrl);
      result.push(signedUrl);
    } else {
      // Segment (.ts, .mp4, .aac, etc.) → direct CDN URL (NO proxy)
      result.push(absoluteUrl);
    }
  }

  return result.join("\n");
}

async function rewriteUriInTag(
  line: string,
  baseUrl: string,
  functionUrl: string
): Promise<string> {
  const match = line.match(/URI="([^"]+)"/);
  if (!match) return line;

  const absoluteUrl = resolveUrl(match[1], baseUrl);

  if (isM3u8Url(absoluteUrl)) {
    // Sub-playlist or key file that's m3u8 → proxy
    const signedUrl = await generateSubPlaylistSignedUrl(absoluteUrl, functionUrl);
    return line.replace(`URI="${match[1]}"`, `URI="${signedUrl}"`);
  }

  // Non-m3u8 URI (e.g., encryption key .key file) → resolve to absolute but don't proxy
  return line.replace(`URI="${match[1]}"`, `URI="${absoluteUrl}"`);
}

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  try {
    // === MODE: generate === (POST)
    // Client sends token_code + playlist_id to get a signed proxy URL
    if (req.method === "POST" && (!mode || mode === "generate")) {
      const body = await req.json();
      const { token_code, playlist_id } = body;

      if (!token_code || !playlist_id) {
        return new Response(
          JSON.stringify({ error: "Missing token_code or playlist_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate token via RPC
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: validation, error: valErr } = await supabase.rpc("validate_token", {
        _code: token_code,
      });

      if (valErr || !(validation as any)?.valid) {
        return new Response(
          JSON.stringify({ error: "Token tidak valid atau expired" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify playlist exists and is m3u8
      const { data: playlist, error: plErr } = await supabase
        .from("playlists")
        .select("id, type, url")
        .eq("id", playlist_id)
        .single();

      if (plErr || !playlist) {
        return new Response(
          JSON.stringify({ error: "Playlist tidak ditemukan" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (playlist.type !== "m3u8") {
        return new Response(
          JSON.stringify({ error: "Tokenized URL hanya untuk m3u8" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const functionUrl = `${SUPABASE_URL}/functions/v1`;
      const signedUrl = await generatePlaylistSignedUrl(playlist_id, functionUrl);

      return new Response(
        JSON.stringify({ signed_url: signedUrl, expires_in: PLAYLIST_TOKEN_TTL }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MODE: play === (GET)
    // Proxy the MASTER m3u8 playlist only. Segments go direct to CDN.
    if (req.method === "GET" && mode === "play") {
      const pid = url.searchParams.get("pid");
      const exp = url.searchParams.get("exp");
      const sig = url.searchParams.get("sig");

      if (!pid || !exp || !sig) {
        return new Response("Missing parameters", { status: 400, headers: corsHeaders });
      }

      if (Date.now() / 1000 > parseInt(exp, 10)) {
        return new Response("Token expired", { status: 403, headers: corsHeaders });
      }

      const valid = await hmacVerify(`playlist:${pid}:${exp}`, sig);
      if (!valid) {
        return new Response("Invalid signature", { status: 403, headers: corsHeaders });
      }

      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: playlist } = await supabase
        .from("playlists")
        .select("url")
        .eq("id", pid)
        .single();

      if (!playlist) {
        return new Response("Playlist not found", { status: 404, headers: corsHeaders });
      }

      // Fetch the actual m3u8 (small file, ~1-5KB)
      const m3u8Response = await fetch(playlist.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StreamProxy/1.0)" },
      });

      if (!m3u8Response.ok) {
        return new Response("Failed to fetch stream", { status: 502, headers: corsHeaders });
      }

      const m3u8Content = await m3u8Response.text();
      const functionUrl = `${SUPABASE_URL}/functions/v1`;
      const baseUrl = getBaseUrl(playlist.url);

      // HYBRID rewrite: only sub-playlists (.m3u8) get proxied, segments stay CDN-direct
      const rewritten = await rewriteM3u8Hybrid(m3u8Content, baseUrl, functionUrl);

      return new Response(rewritten, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache, no-store",
          "Access-Control-Expose-Headers": "Content-Type",
        },
      });
    }

    // === MODE: sub === (GET)
    // Proxy SUB-PLAYLISTS only (variant/quality m3u8 files, ~1-5KB each).
    // These contain the actual segment (.ts) URLs which we resolve to absolute
    // CDN URLs so the player fetches segments DIRECTLY from CDN.
    if (req.method === "GET" && mode === "sub") {
      const encoded = url.searchParams.get("u");
      const exp = url.searchParams.get("exp");
      const sig = url.searchParams.get("sig");

      if (!encoded || !exp || !sig) {
        return new Response("Missing parameters", { status: 400, headers: corsHeaders });
      }

      if (Date.now() / 1000 > parseInt(exp, 10)) {
        return new Response("Token expired", { status: 403, headers: corsHeaders });
      }

      const valid = await hmacVerify(`sub:${encoded}:${exp}`, sig);
      if (!valid) {
        return new Response("Invalid signature", { status: 403, headers: corsHeaders });
      }

      const actualUrl = base64UrlDecode(encoded);

      // Fetch the sub-playlist (small file)
      const subResponse = await fetch(actualUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StreamProxy/1.0)" },
      });

      if (!subResponse.ok) {
        return new Response("Failed to fetch sub-playlist", { status: 502, headers: corsHeaders });
      }

      const subContent = await subResponse.text();
      const functionUrl = `${SUPABASE_URL}/functions/v1`;
      const baseUrl = getBaseUrl(actualUrl);

      // Rewrite: sub-m3u8 references get proxied, segments stay CDN-direct
      const rewritten = await rewriteM3u8Hybrid(subContent, baseUrl, functionUrl);

      return new Response(rewritten, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache, no-store",
        },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  } catch (err) {
    console.error("stream-proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
