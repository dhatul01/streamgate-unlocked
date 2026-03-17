import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Use service role key as HMAC signing secret
const SIGNING_SECRET = SERVICE_ROLE_KEY;

// Token validity durations (seconds)
const PLAYLIST_TOKEN_TTL = 300; // 5 minutes for main playlist
const SEGMENT_TOKEN_TTL = 600; // 10 minutes for segments

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
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return decodeURIComponent(escape(atob(str)));
}

// --- Generate signed URL for a playlist ---
async function generateSignedUrl(
  playlistId: string,
  functionUrl: string,
  ttl: number = PLAYLIST_TOKEN_TTL
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const message = `playlist:${playlistId}:${exp}`;
  const sig = await hmacSign(message);
  return `${functionUrl}/stream-proxy?mode=play&pid=${playlistId}&exp=${exp}&sig=${sig}`;
}

// --- Generate signed URL for a segment/sub-playlist ---
async function generateSegmentUrl(
  rawUrl: string,
  functionUrl: string,
  ttl: number = SEGMENT_TOKEN_TTL
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const encoded = base64UrlEncode(rawUrl);
  const message = `segment:${encoded}:${exp}`;
  const sig = await hmacSign(message);
  return `${functionUrl}/stream-proxy?mode=seg&u=${encoded}&exp=${exp}&sig=${sig}`;
}

// --- Rewrite URLs inside m3u8 content ---
async function rewriteM3u8(
  content: string,
  baseUrl: string,
  functionUrl: string
): Promise<string> {
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines or comment/tag lines (but not URI= in tags)
    if (!trimmed || trimmed.startsWith("#")) {
      // Check for URI= in EXT-X-MAP or EXT-X-KEY
      if (trimmed.includes('URI="')) {
        const rewritten = await rewriteUriInTag(trimmed, baseUrl, functionUrl);
        result.push(rewritten);
      } else {
        result.push(line);
      }
      continue;
    }

    // This is a URL line (segment or sub-playlist)
    const absoluteUrl = resolveUrl(trimmed, baseUrl);
    const signedUrl = await generateSegmentUrl(absoluteUrl, functionUrl);
    result.push(signedUrl);
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
  const signedUrl = await generateSegmentUrl(absoluteUrl, functionUrl);
  return line.replace(`URI="${match[1]}"`, `URI="${signedUrl}"`);
}

function resolveUrl(url: string, base: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return new URL(url, base).href;
  } catch {
    // Fallback: join paths
    const basePath = base.substring(0, base.lastIndexOf("/") + 1);
    return basePath + url;
  }
}

function getBaseUrl(url: string): string {
  return url.substring(0, url.lastIndexOf("/") + 1);
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

      // Verify playlist exists
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

      // Only generate signed URLs for m3u8 type
      if (playlist.type !== "m3u8") {
        return new Response(
          JSON.stringify({ error: "Tokenized URL hanya untuk m3u8" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const functionUrl = `${SUPABASE_URL}/functions/v1`;
      const signedUrl = await generateSignedUrl(playlist_id, functionUrl);

      return new Response(
        JSON.stringify({
          signed_url: signedUrl,
          expires_in: PLAYLIST_TOKEN_TTL,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MODE: play === (GET)
    // Serve proxied m3u8 content with rewritten segment URLs
    if (req.method === "GET" && mode === "play") {
      const pid = url.searchParams.get("pid");
      const exp = url.searchParams.get("exp");
      const sig = url.searchParams.get("sig");

      if (!pid || !exp || !sig) {
        return new Response("Missing parameters", {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Verify expiration
      const expTime = parseInt(exp, 10);
      if (Date.now() / 1000 > expTime) {
        return new Response("Token expired", {
          status: 403,
          headers: corsHeaders,
        });
      }

      // Verify HMAC
      const message = `playlist:${pid}:${exp}`;
      const valid = await hmacVerify(message, sig);
      if (!valid) {
        return new Response("Invalid signature", {
          status: 403,
          headers: corsHeaders,
        });
      }

      // Fetch actual playlist URL from DB
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: playlist, error: plErr } = await supabase
        .from("playlists")
        .select("url")
        .eq("id", pid)
        .single();

      if (plErr || !playlist) {
        return new Response("Playlist not found", {
          status: 404,
          headers: corsHeaders,
        });
      }

      // Fetch the actual m3u8 content
      const m3u8Response = await fetch(playlist.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; StreamProxy/1.0)",
        },
      });

      if (!m3u8Response.ok) {
        return new Response("Failed to fetch stream", {
          status: 502,
          headers: corsHeaders,
        });
      }

      const m3u8Content = await m3u8Response.text();
      const functionUrl = `${SUPABASE_URL}/functions/v1`;
      const baseUrl = getBaseUrl(playlist.url);

      // Rewrite all URLs in the m3u8 to go through our proxy
      const rewritten = await rewriteM3u8(m3u8Content, baseUrl, functionUrl);

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

    // === MODE: seg === (GET)
    // Proxy individual segments or sub-playlists
    if (req.method === "GET" && mode === "seg") {
      const encoded = url.searchParams.get("u");
      const exp = url.searchParams.get("exp");
      const sig = url.searchParams.get("sig");

      if (!encoded || !exp || !sig) {
        return new Response("Missing parameters", {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Verify expiration
      const expTime = parseInt(exp, 10);
      if (Date.now() / 1000 > expTime) {
        return new Response("Token expired", {
          status: 403,
          headers: corsHeaders,
        });
      }

      // Verify HMAC
      const message = `segment:${encoded}:${exp}`;
      const valid = await hmacVerify(message, sig);
      if (!valid) {
        return new Response("Invalid signature", {
          status: 403,
          headers: corsHeaders,
        });
      }

      const actualUrl = base64UrlDecode(encoded);

      // Fetch the actual segment/sub-playlist
      const segResponse = await fetch(actualUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; StreamProxy/1.0)",
        },
      });

      if (!segResponse.ok) {
        return new Response("Failed to fetch segment", {
          status: 502,
          headers: corsHeaders,
        });
      }

      // If it's another m3u8 (sub-playlist), rewrite its URLs too
      const contentType = segResponse.headers.get("content-type") || "";
      if (
        actualUrl.endsWith(".m3u8") ||
        actualUrl.includes(".m3u8?") ||
        contentType.includes("mpegurl") ||
        contentType.includes("x-mpegURL")
      ) {
        const subContent = await segResponse.text();
        const functionUrl = `${SUPABASE_URL}/functions/v1`;
        const baseUrl = getBaseUrl(actualUrl);
        const rewritten = await rewriteM3u8(subContent, baseUrl, functionUrl);

        return new Response(rewritten, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-cache, no-store",
          },
        });
      }

      // Binary segment (.ts, .mp4, etc.) — stream directly
      const headers: Record<string, string> = {
        ...corsHeaders,
        "Cache-Control": "public, max-age=30",
      };
      const ct = segResponse.headers.get("content-type");
      if (ct) headers["Content-Type"] = ct;
      const cl = segResponse.headers.get("content-length");
      if (cl) headers["Content-Length"] = cl;

      return new Response(segResponse.body, {
        status: 200,
        headers,
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
