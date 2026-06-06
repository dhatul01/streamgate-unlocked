import { useEffect, useState, useCallback } from "react";

interface CastButtonProps {
  videoEl: HTMLVideoElement | null;
  /** Saat tipe iframe (Cloudflare/YouTube), Remote Playback tidak tersedia.
   *  Tombol akan menyarankan screen-mirror dari menu perangkat. */
  iframeMode?: boolean;
}

/**
 * Tombol Cast universal:
 * - Safari (iOS/macOS): AirPlay via `video.webkitShowPlaybackTargetPicker()`
 * - Chromium/Edge: Remote Playback API → memunculkan picker Chromecast bawaan
 * - Iframe (YouTube/Cloudflare): fallback ke instruksi screen mirror perangkat
 */
const CastButton = ({ videoEl, iframeMode = false }: CastButtonProps) => {
  const [available, setAvailable] = useState(false);
  const [casting, setCasting] = useState(false);

  useEffect(() => {
    if (iframeMode) {
      // Selalu tampilkan tombol — fallback ke instruksi mirror device.
      setAvailable(true);
      return;
    }
    if (!videoEl) { setAvailable(false); return; }
    const anyVid = videoEl as any;

    // Safari AirPlay
    const hasAirPlay = typeof anyVid.webkitShowPlaybackTargetPicker === "function";

    // Remote Playback API
    const remote = anyVid.remote;
    if (remote && typeof remote.watchAvailability === "function") {
      let cbId: number | null = null;
      remote.watchAvailability((avail: boolean) => setAvailable(avail || hasAirPlay))
        .then((id: number) => { cbId = id; })
        .catch(() => setAvailable(hasAirPlay));
      const onConnect = () => setCasting(true);
      const onDisconnect = () => setCasting(false);
      remote.addEventListener?.("connect", onConnect);
      remote.addEventListener?.("disconnect", onDisconnect);
      return () => {
        try { if (cbId != null) remote.cancelWatchAvailability(cbId); } catch {}
        try {
          remote.removeEventListener?.("connect", onConnect);
          remote.removeEventListener?.("disconnect", onDisconnect);
        } catch {}
      };
    }

    setAvailable(hasAirPlay);
  }, [videoEl, iframeMode]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (iframeMode) {
      // Iframe (Cloudflare/YouTube) — sumber video tidak diekspos ke remote.
      // Beri instruksi ringkas tapi tombol tetap bisa ditekan tanpa error.
      try {
        alert(
          "Untuk menyiarkan ke TV/proyektor saat memutar player ini, " +
          "gunakan menu 'Cast/Screen Mirroring' pada perangkat Anda " +
          "(AirPlay di iOS, Cast Screen di Android, atau Chromecast dari menu Chrome ⋮ → 'Cast…')."
        );
      } catch {}
      return;
    }
    if (!videoEl) return;
    const anyVid = videoEl as any;
    try {
      if (typeof anyVid.webkitShowPlaybackTargetPicker === "function") {
        anyVid.webkitShowPlaybackTargetPicker();
        return;
      }
      if (anyVid.remote && typeof anyVid.remote.prompt === "function") {
        await anyVid.remote.prompt();
        return;
      }
    } catch (err) {
      // Picker dibatalkan / tidak tersedia → diam saja.
    }
  }, [videoEl, iframeMode]);

  if (!available) return null;

  return (
    <button
      onClick={handleClick}
      title={casting ? "Sedang cast ke perangkat" : "Cast ke TV / proyektor"}
      aria-label="Cast ke TV atau proyektor"
      className={`flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full backdrop-blur-sm transition active:scale-95 tv:h-14 tv:w-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        casting
          ? "bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.6)]"
          : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
      }`}
    >
      {/* Ikon Cast / AirPlay */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path d="M8 21h8l-4-5-4 5z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
};

export default CastButton;
