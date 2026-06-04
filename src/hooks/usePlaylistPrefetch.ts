import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Warms ALL non-active playlists in the background so switching is instant:
 *
 * - m3u8: calls `stream-proxy` to prime the edge function's in-memory cache
 *         (DB URL lookup + signing), then issues a no-cors GET against the
 *         signed URL to push the manifest + first segment into the browser/CDN
 *         cache. Refreshes every 3 min (signed URL TTL = 5 min).
 * - cloudflare: injects `<link rel="preconnect" + "dns-prefetch" + "prefetch">`
 *               for the customer iframe, so the iframe hand-off is sub-second.
 * - youtube: preconnects to youtube.com/ytimg.com/googlevideo.com so the iframe
 *            API + first chunk arrive faster.
 *
 * Returns nothing — purely a side-effect hook. Safe to call with empty arrays.
 */

type Playlist = { id: string; type: string; url: string };

const PREFETCH_INTERVAL_MS = 3 * 60 * 1000; // 3 min — under 5 min signed URL TTL
const STAGGER_MS = 350; // gradual: don't fire all prefetches at once

const injectLink = (rel: string, href: string, extra?: Record<string, string>): HTMLLinkElement | null => {
  try {
    const existing = document.head.querySelector<HTMLLinkElement>(
      `link[rel="${rel}"][href="${href}"]`
    );
    if (existing) return existing;
    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    if (extra) Object.entries(extra).forEach(([k, v]) => link.setAttribute(k, v));
    document.head.appendChild(link);
    return link;
  } catch {
    return null;
  }
};

const warmSignedUrl = async (signedUrl: string) => {
  try {
    // no-cors GET — we don't care about the response, only about populating
    // the browser+CDN cache so the next real fetch is a cache hit.
    await fetch(signedUrl, {
      method: "GET",
      mode: "no-cors",
      credentials: "omit",
      cache: "default",
    });
  } catch { /* ignore — best effort */ }
};

export function usePlaylistPrefetch(
  playlists: Playlist[] | null | undefined,
  activeId: string | null | undefined,
  tokenCode: string | null | undefined,
  enabled: boolean = true,
) {
  const injectedLinksRef = useRef<HTMLLinkElement[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!enabled || !tokenCode || !playlists || playlists.length < 2) return;

    const others = playlists.filter((p) => p.id !== activeId);
    if (others.length === 0) return;

    // 1) Inject preconnect/prefetch links for non-m3u8 streams (synchronous, cheap)
    others.forEach((p) => {
      if (p.type === "cloudflare" && p.url) {
        const origin = `https://customer-${p.url}.cloudflarestream.com`;
        const iframeUrl = `${origin}/iframe`;
        const l1 = injectLink("preconnect", origin, { crossorigin: "" });
        const l2 = injectLink("dns-prefetch", origin);
        const l3 = injectLink("prefetch", iframeUrl, { as: "document" });
        [l1, l2, l3].forEach((l) => l && injectedLinksRef.current.push(l));
      } else if (p.type === "youtube") {
        ["https://www.youtube.com", "https://www.youtube-nocookie.com", "https://i.ytimg.com", "https://yt3.ggpht.com"].forEach((origin) => {
          const l1 = injectLink("preconnect", origin, { crossorigin: "" });
          const l2 = injectLink("dns-prefetch", origin);
          [l1, l2].forEach((l) => l && injectedLinksRef.current.push(l));
        });
      }
    });

    // 2) Prefetch m3u8 signed URLs — staggered to avoid burst on edge function
    const m3u8Others = others.filter((p) => p.type === "m3u8");

    const prefetchM3u8 = (playlist: Playlist, delayMs: number) => {
      const t = setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke("stream-proxy", {
            method: "POST",
            body: { token_code: tokenCode, playlist_id: playlist.id },
          });
          if (error) return;
          const signed = (data as any)?.signed_url;
          if (signed) await warmSignedUrl(signed);
        } catch { /* ignore */ }
      }, delayMs);
      staggerTimersRef.current.push(t);
    };

    const runRound = () => {
      m3u8Others.forEach((p, i) => prefetchM3u8(p, i * STAGGER_MS));
    };

    // First round: small initial delay so the active playlist's signing
    // request takes priority on the same edge function.
    const initialDelay = setTimeout(runRound, 1200);
    staggerTimersRef.current.push(initialDelay);

    // Periodic refresh — keep prefetched URLs warm
    timerRef.current = setInterval(runRound, PREFETCH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      staggerTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current = [];
    };
  }, [enabled, tokenCode, activeId, playlists?.map((p) => `${p.id}:${p.type}`).join(",")]);

  // Cleanup injected links on unmount
  useEffect(() => {
    return () => {
      injectedLinksRef.current.forEach((l) => { try { l.remove(); } catch {} });
      injectedLinksRef.current = [];
    };
  }, []);
}
