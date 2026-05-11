import { useEffect, useRef, useState } from "react";

interface HeroVideoBackgroundProps {
  /** URL video (.mp4/.webm langsung, atau HLS .m3u8). */
  url?: string;
  poster?: string;
  /** 0-100. 100 = paling terang. Default 60. */
  brightness?: number;
  className?: string;
}

const isHls = (url: string) => /\.m3u8(\?|$)/i.test(url);

const pickStartLevel = (levels: Array<{ bitrate?: number; height?: number }>) => {
  if (!levels?.length) return -1;
  let candidate = -1;
  let bestBitrate = Infinity;
  levels.forEach((lv, i) => {
    const h = lv.height || 0;
    const br = lv.bitrate || 0;
    if (h && h <= 480 && br < bestBitrate) { candidate = i; bestBitrate = br; }
  });
  if (candidate >= 0) return candidate;
  let lowest = 0; let lowestBr = Infinity;
  levels.forEach((lv, i) => {
    const br = lv.bitrate || 0;
    if (br < lowestBr) { lowestBr = br; lowest = i; }
  });
  return lowest;
};

const HeroVideoBackground = ({ url, poster, brightness = 60, className = "" }: HeroVideoBackgroundProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsInstanceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    try {
      const conn: any = (navigator as any).connection;
      if (conn?.saveData) return;
      if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;
    } catch { /* ignore */ }
    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 200));
    const id = ric(() => { if (!cancelled) setReady(true); }, { timeout: 1500 });
    return () => {
      cancelled = true;
      try {
        const cic: any = (window as any).cancelIdleCallback;
        if (cic) cic(id); else clearTimeout(id);
      } catch { /* noop */ }
    };
  }, [url]);

  useEffect(() => {
    if (!ready || !url) return;
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;

    const cleanup = () => {
      try {
        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
          hlsInstanceRef.current = null;
        }
      } catch { /* noop */ }
    };

    const startNative = () => {
      video.src = url;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    if (!isHls(url)) {
      startNative();
      return cleanup;
    }

    const canNative = video.canPlayType("application/vnd.apple.mpegurl");
    if (canNative) {
      startNative();
      return cleanup;
    }

    import("hls.js").then((mod) => {
      if (disposed) return;
      const Hls = mod.default;
      if (!Hls.isSupported()) { startNative(); return; }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        startLevel: -1,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 30 * 1024 * 1024,
        backBufferLength: 5,
        nudgeMaxRetry: 5,
      });
      hlsInstanceRef.current = hls;
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
      hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
        const start = pickStartLevel(data?.levels || []);
        if (start >= 0) hls.startLevel = start;
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (!data?.fatal) return;
        try {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { hls.destroy(); setHidden(true); }
        } catch { setHidden(true); }
      });
    }).catch(() => setHidden(true));

    return () => { disposed = true; cleanup(); };
  }, [ready, url]);

  useEffect(() => {
    const v = videoRef.current;
    const c = containerRef.current;
    if (!v || !c || !ready) return;
    let inView = true;
    let pageVisible = !document.hidden;
    const tryPlay = () => {
      if (inView && pageVisible) {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } else v.pause();
    };
    const io = new IntersectionObserver(
      (entries) => { inView = entries[0]?.isIntersecting ?? false; tryPlay(); },
      { threshold: 0.01 }
    );
    io.observe(c);
    const onVis = () => { pageVisible = !document.hidden; tryPlay(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [ready]);

  if (!url || hidden) return null;

  const b = Math.max(0, Math.min(100, brightness));
  const videoOpacity = 0.25 + (b / 100) * 0.75;
  const overlayAlpha = 0.7 - (b / 100) * 0.7;

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <video
        ref={videoRef}
        className="h-full w-full object-cover transition-opacity duration-300"
        style={{ opacity: videoOpacity }}
        autoPlay muted loop playsInline preload="metadata"
        disablePictureInPicture controls={false}
        poster={poster}
        onError={() => setHidden(true)}
      />
      <div
        className="absolute inset-0 transition-colors duration-300"
        style={{ backgroundColor: `rgba(0,0,0,${overlayAlpha.toFixed(3)})` }}
      />
    </div>
  );
};

export default HeroVideoBackground;
