import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback, lazy, Suspense } from "react";

const Watermark = lazy(() => import("@/components/viewer/Watermark"));
const TextWatermark = lazy(() => import("@/components/viewer/TextWatermark"));

const M3U8_QUALITY_STORAGE_KEY = "r48:m3u8-quality-lock";
const USER_UNMUTED_KEY = "r48:user-unmuted";

const readUserUnmuted = (): boolean => {
  try { return sessionStorage.getItem(USER_UNMUTED_KEY) === "1"; } catch { return false; }
};
const writeUserUnmuted = (v: boolean) => {
  try {
    if (v) sessionStorage.setItem(USER_UNMUTED_KEY, "1");
    else sessionStorage.removeItem(USER_UNMUTED_KEY);
  } catch {}
};

type StoredM3u8Quality = {
  mode: "auto" | "manual";
  height?: number | null;
  bitrate?: number | null;
  label?: string;
};

type HlsQualityLevel = { height?: number; bitrate?: number };

const getLevelLabel = (level?: HlsQualityLevel) =>
  level?.height ? `${level.height}p` : `${Math.round((level?.bitrate || 0) / 1000)}k`;

const getLowestLevelIndex = (levels: HlsQualityLevel[] = []) => {
  if (!levels.length) return -1;
  return levels.reduce((best, level, index) => {
    const currentScore = (level?.height || 99999) * 10_000_000 + (level?.bitrate || 999999999);
    const bestLevel = levels[best];
    const bestScore = (bestLevel?.height || 99999) * 10_000_000 + (bestLevel?.bitrate || 999999999);
    return currentScore < bestScore ? index : best;
  }, 0);
};

const readStoredM3u8Quality = (): StoredM3u8Quality | null => {
  try {
    const raw = localStorage.getItem(M3U8_QUALITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredM3u8Quality = (quality: StoredM3u8Quality) => {
  try { localStorage.setItem(M3U8_QUALITY_STORAGE_KEY, JSON.stringify(quality)); } catch { /* ignore */ }
};

const findStoredLevelIndex = (levels: HlsQualityLevel[] = [], stored: StoredM3u8Quality | null) => {
  if (!stored || stored.mode !== "manual") return -1;
  if (stored.height) {
    const exactHeight = levels.findIndex((level) => level?.height === stored.height);
    if (exactHeight >= 0) return exactHeight;
  }
  if (stored.label) {
    const exactLabel = levels.findIndex((level) => getLevelLabel(level) === stored.label);
    if (exactLabel >= 0) return exactLabel;
  }
  return getLowestLevelIndex(levels);
};

const getHlsSourceIdentity = (url: string) => {
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("mode");
    if (mode === "play") return `${parsed.origin}${parsed.pathname}:play:${parsed.searchParams.get("pid") || ""}`;
    if (mode === "sub") return `${parsed.origin}${parsed.pathname}:sub:${parsed.searchParams.get("u") || ""}`;
    parsed.searchParams.delete("exp");
    parsed.searchParams.delete("sig");
    return parsed.toString();
  } catch {
    return url;
  }
};

interface VideoPlayerProps {
  playlist: {
    type: string;
    url: string;
    label: string;
  };
  autoPlay?: boolean;
  watermarkUrl?: string;
  tokenCode?: string;
  /** Watermark teks transparan menutupi player */
  watermarkText?: string;
  /** Skala watermark teks 10..100 (persen) */
  watermarkTextSize?: number;
  /** Aktifkan watermark teks */
  watermarkTextEnabled?: boolean;
  /** Transparansi watermark teks 1..100 (persen). Default 12. */
  watermarkTextOpacity?: number;
}

export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo?: (time: number) => void;
  getCurrentTime?: () => number;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({ playlist, autoPlay = true, watermarkUrl, tokenCode, watermarkText, watermarkTextSize = 30, watermarkTextEnabled = false, watermarkTextOpacity = 12 }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [isSwitchingQuality, setIsSwitchingQuality] = useState(false);
  const [qualities, setQualities] = useState<{ label: string; index: number; ytKey?: string; height?: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
  const [pendingQuality, setPendingQuality] = useState<number | null>(null);
  const qualitySwitchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forcedLandscape, setForcedLandscape] = useState(false);
  const [ytMuted, setYtMuted] = useState(true);
  const [videoMuted, setVideoMuted] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [cloudflareKey, setCloudflareKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const bufferingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hlsInitRef = useRef(false);
  const latestHlsUrlRef = useRef<string | null>(null);
  const loadedHlsUrlRef = useRef<string | null>(null);
  const hlsSourceReadyRef = useRef(false);
  const hasHlsPlaybackStartedRef = useRef(false);
  // Reconnect tracking — exponential backoff for 7-hour stability
  const reconnectAttemptRef = useRef(0);
  const stallWatchdogRef = useRef<ReturnType<typeof setInterval>>();
  const lastProgressRef = useRef({ time: 0, at: Date.now() });
  // Auto-fallback ke level lebih rendah ketika stall berulang. Tidak pernah
  // aktif bila user telah mengunci resolusi (mode "manual").
  const stallStreakRef = useRef(0);
  const lastFallbackAtRef = useRef(0);
  const userManualQualityRef = useRef<boolean>(
    typeof window !== "undefined" && readStoredM3u8Quality()?.mode === "manual"
  );
  const hlsSourceIdentity = useMemo(
    () => playlist.type === "m3u8" ? getHlsSourceIdentity(playlist.url) : playlist.url,
    [playlist.type, playlist.url]
  );

  // Network-aware: deteksi koneksi lambat / Save-Data agar mulai dari bitrate terendah
  const isSlowConnection = useMemo(() => {
    try {
      const c: any = (navigator as any).connection;
      if (!c) return false;
      if (c.saveData) return true;
      const t = c.effectiveType || "";
      if (t === "slow-2g" || t === "2g" || t === "3g") return true;
      if (typeof c.downlink === "number" && c.downlink > 0 && c.downlink < 1.5) return true;
      return false;
    } catch { return false; }
  }, []);

  // Pesan loading berputar agar pengguna tahu sedang ada proses
  useEffect(() => {
    if (!isLoading) return;
    setLoadingPhase(0);
    const id = setInterval(() => setLoadingPhase((p) => (p + 1) % 4), 1800);
    return () => clearInterval(id);
  }, [isLoading]);

  // Helper: check if YT player API is usable
  const isYTReady = useCallback(() => {
    const p = ytPlayerRef.current;
    return p && ytReadyRef.current && typeof p.getPlayerState === "function" && typeof p.playVideo === "function";
  }, []);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (playlist.type === "youtube" && isYTReady()) {
        const player = ytPlayerRef.current;
        try {
          const duration = player.getDuration?.();
          if (duration && duration > 0) player.seekTo(duration, true);
        } catch {}
        player.playVideo();
      } else if (playlist.type === "m3u8" && hlsRef.current && videoRef.current) {
        if (hlsRef.current.liveSyncPosition) {
          videoRef.current.currentTime = hlsRef.current.liveSyncPosition;
        }
        videoRef.current.play();
        setIsPlaying(true);
      } else if (videoRef.current) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    },
    pause: () => {
      if (playlist.type === "youtube" && isYTReady()) {
        ytPlayerRef.current.pauseVideo();
      } else if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    },
    seekTo: (time: number) => {
      if (playlist.type === "youtube" && isYTReady()) {
        ytPlayerRef.current.seekTo(time, true);
      } else if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    getCurrentTime: () => {
      if (playlist.type === "youtube" && isYTReady()) {
        try { return ytPlayerRef.current.getCurrentTime() || 0; } catch { return 0; }
      }
      return videoRef.current?.currentTime || 0;
    },
  }), [playlist.type, isYTReady]);

  // Hide controls after 3s — passive event listeners for performance
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    el.addEventListener("mousemove", resetTimer, { passive: true });
    el.addEventListener("touchstart", resetTimer, { passive: true });
    resetTimer();
    return () => {
      clearTimeout(controlsTimeoutRef.current);
      el.removeEventListener("mousemove", resetTimer);
      el.removeEventListener("touchstart", resetTimer);
    };
  }, []);

  // Cleanup HLS on unmount or playlist change
  useEffect(() => {
    setIsLoading(true);
    hlsInitRef.current = false;
    loadedHlsUrlRef.current = null;
    hlsSourceReadyRef.current = false;
    hasHlsPlaybackStartedRef.current = false;
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playlist.type, hlsSourceIdentity]);

  // Obfuscate helper: encode/decode video source at runtime
  const obfuscate = useCallback((str: string) => btoa(unescape(encodeURIComponent(str))), []);
  const deobfuscate = useCallback((str: string) => decodeURIComponent(escape(atob(str))), []);

  // XOR decrypt for server-encrypted YouTube URLs
  const decryptUrl = useCallback((encoded: string): string => {
    if (!encoded.startsWith("enc:")) return encoded;
    const b64 = encoded.slice(4);
    const _k = [82,84,52,56,120,75,57,109,81,50,118,76,55,110,80,52];
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      result[i] = bytes[i] ^ _k[i % _k.length];
    }
    return new TextDecoder().decode(result);
  }, []);

  // Keep signed HLS URL fresh without remounting/reconnecting the player.
  useEffect(() => {
    if (playlist.type !== "m3u8") return;
    const decodedUrl = deobfuscate(obfuscate(playlist.url));
    latestHlsUrlRef.current = decodedUrl;
    if (!hlsRef.current || !hlsSourceReadyRef.current || loadedHlsUrlRef.current === decodedUrl) return;

    try {
      const hls = hlsRef.current;
      const lockedLevel = hls.currentLevel;
      hls.stopLoad();
      hls.loadSource(decodedUrl);
      loadedHlsUrlRef.current = decodedUrl;
      if (typeof lockedLevel === "number") {
        hls.currentLevel = lockedLevel;
        hls.nextLevel = lockedLevel;
        hls.loadLevel = lockedLevel;
        hls.startLevel = lockedLevel;
      }
      hls.startLoad(videoRef.current?.currentTime || -1);
    } catch { /* ignore */ }
  }, [playlist.type, playlist.url, obfuscate, deobfuscate]);

  // Init HLS for m3u8 — optimized with memory management
  useEffect(() => {
    if (playlist.type !== "m3u8" || !videoRef.current || hlsInitRef.current) return;
    hlsInitRef.current = true;

    let destroyed = false;
    let hls: any = null;
    const markPlaybackSmooth = () => {
      hasHlsPlaybackStartedRef.current = true;
      setIsLoading(false);
      setIsPlaying(true);
      clearTimeout(bufferingTimerRef.current);
      setIsBuffering(false);
    };
    // Silent buffer/stall hint: never toggles the main overlay after first playback.
    // Tampilkan pill kecil "Buffering..." setelah 700ms supaya pengguna tahu tidak freeze.
    const onWaiting = () => {
      if (destroyed || !hlsRef.current) return;
      if (!hasHlsPlaybackStartedRef.current) return;
      try { hlsRef.current.startLoad(videoRef.current?.currentTime ?? -1); } catch {}
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = setTimeout(() => {
        if (!destroyed) setIsBuffering(true);
      }, 700);
    };
    const onPlayingClear = () => {
      clearTimeout(bufferingTimerRef.current);
      setIsBuffering(false);
    };

    const initHls = async () => {
      const Hls = (await import("hls.js")).default;
      if (destroyed) return;

      videoRef.current?.removeEventListener("playing", markPlaybackSmooth);
      videoRef.current?.removeEventListener("canplay", markPlaybackSmooth);
      const decodedUrl = latestHlsUrlRef.current;
      if (!decodedUrl) return;
      if (!Hls.isSupported()) {
        videoRef.current!.src = decodedUrl;
        if (autoPlay) videoRef.current!.play().catch(() => {});
        return;
      }

      hls = new Hls({
        // Live tuning — JAUH dari live edge supaya tidak rebase / loncat-loncat.
        // Trade-off: latency naik tapi playback jauh lebih halus pada koneksi fluktuatif.
        liveSyncDurationCount: isSlowConnection ? 10 : 8,
        liveMaxLatencyDurationCount: isSlowConnection ? 30 : 24,
        liveDurationInfinity: true,
        // Penting: jangan pernah percepat playback untuk mengejar live edge (penyebab "rubber-band").
        maxLiveSyncPlaybackRate: 1,
        liveBackBufferLength: 60,
        maxBufferLength: isSlowConnection ? 120 : 90,
        maxMaxBufferLength: isSlowConnection ? 240 : 180,
        maxBufferSize: 240 * 1000 * 1000,
        // Lubang buffer kecil dilewati senyap tanpa nudge yang terasa.
        maxBufferHole: 2.0,
        maxFragLookUpTolerance: 0.5,
        highBufferWatchdogPeriod: 5,
        nudgeOffset: 0.3,
        nudgeMaxRetry: 10,
        backBufferLength: 60,
        // ABR — sangat konservatif: lebih baik tetap di resolusi rendah yang
        // mulus daripada naik turun (sumber utama "loncat-loncat" yang dirasakan).
        abrEwmaDefaultEstimate: isSlowConnection ? 300_000 : 600_000,
        abrEwmaFastLive: isSlowConnection ? 10 : 8,
        abrEwmaSlowLive: isSlowConnection ? 30 : 24,
        abrBandWidthFactor: isSlowConnection ? 0.5 : 0.65,
        abrBandWidthUpFactor: isSlowConnection ? 0.2 : 0.3,
        abrMaxWithRealBitrate: true,
        // Recovery & retry — generous on manifest so a flaky CDN won't leave the player blank
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 600,
        fragLoadingMaxRetryTimeout: 30_000,
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 600,
        manifestLoadingMaxRetryTimeout: 30_000,
        levelLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 600,
        levelLoadingMaxRetryTimeout: 30_000,
        // Start only after manifest is parsed so we can lock the lowest/user-selected level first.
        autoStartLoad: false,
        startLevel: 0,
        startFragPrefetch: true,
        testBandwidth: !isSlowConnection,
        // `progressive: true` mem-stream fragmen yang belum selesai download —
        // di banyak encoder ini malah bikin micro-stall. Matikan untuk smoothness.
        progressive: false,
        lowLatencyMode: false,
        debug: false,
      });

      hlsRef.current = hls;
      hls.attachMedia(videoRef.current!);
      loadedHlsUrlRef.current = decodedUrl;
      hlsSourceReadyRef.current = false;
      hls.loadSource(decodedUrl);
      // NOTE: do NOT override video.src / currentSrc — hls.js relies on the
      // native MediaSource attachment, and intercepting these properties can
      // leave the player visually blank in some Chromium builds.

      hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
        if (destroyed) return;
        const hlsLevels: HlsQualityLevel[] = hls.levels || data.levels || [];
        const storedQuality = readStoredM3u8Quality();
        const storedLevel = findStoredLevelIndex(hlsLevels, storedQuality);
        const preferredLevel = storedQuality?.mode === "auto"
          ? -1
          : storedLevel >= 0
            ? storedLevel
            : getLowestLevelIndex(hlsLevels);
        const levels = hlsLevels.map((l, i: number) => ({
          label: getLevelLabel(l),
          index: i,
          height: l.height,
        }));
        setQualities([{ label: "Auto", index: -1 }, ...levels]);
        hls.currentLevel = preferredLevel;
        hls.nextLevel = preferredLevel;
        hls.loadLevel = preferredLevel;
        hls.startLevel = preferredLevel;
        setCurrentQuality(preferredLevel);
        setActiveHeight(preferredLevel >= 0 ? hlsLevels[preferredLevel]?.height ?? null : null);
        setIsLoading(false);
        hlsSourceReadyRef.current = true;
        hls.startLoad(-1);
        if (autoPlay) {
          const v = videoRef.current!;
          // If user already unmuted earlier in this session, try unmuted first
          // so switching playlists doesn't silence audio.
          const wantUnmuted = readUserUnmuted();
          v.muted = !wantUnmuted;
          setVideoMuted(!wantUnmuted);
          v.play()
            .then(() => setIsPlaying(true))
            .catch(() => {
              // Autoplay rejected — fall back to muted autoplay
              try {
                v.muted = true;
                setVideoMuted(true);
                v.play().then(() => setIsPlaying(true)).catch(() => {});
              } catch {}
            });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHING, () => {
        if (!destroyed) setIsSwitchingQuality(true);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => {
        if (destroyed) return;
        setIsSwitchingQuality(false);
        setPendingQuality(null);
        clearTimeout(qualitySwitchTimerRef.current);
        try {
          const lvl = hls.levels?.[data.level];
          setActiveHeight(lvl?.height ?? null);
        } catch {}
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (!destroyed) setIsSwitchingQuality(false);
      });

      videoRef.current?.addEventListener("playing", markPlaybackSmooth);
      videoRef.current?.addEventListener("canplay", markPlaybackSmooth);
      videoRef.current?.addEventListener("playing", onPlayingClear);
      videoRef.current?.addEventListener("timeupdate", onPlayingClear);

      videoRef.current?.addEventListener("waiting", onWaiting);
      videoRef.current?.addEventListener("stalled", onWaiting);

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (destroyed) return;
        setIsSwitchingQuality(false);

        const isManifestError =
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT;

        // Overlay rule: only show "Connecting..." before first playback.
        // Once playback has started, ALL recovery is silent — never re-show overlay.
        if (hasHlsPlaybackStartedRef.current) {
          setIsLoading(false);
        } else if (isManifestError) {
          setIsLoading(true);
        } else if (!data.fatal) {
          setIsLoading(false);
        }

        if (data.fatal || isManifestError) {
          const attempt = ++reconnectAttemptRef.current;
          const backoff = Math.min(1500 * Math.pow(1.5, Math.min(attempt - 1, 8)), 30_000);

          // Manifest failed → reinit hls.js entirely after a few retries
          const fullReinit = () => {
            try { hls.destroy(); } catch {}
            hlsRef.current = null;
            hlsInitRef.current = false;
            setTimeout(() => { if (!destroyed) initHls(); }, backoff);
          };

          if (isManifestError) {
            if (attempt <= 3) {
              setTimeout(() => { if (!destroyed && hls) hls.startLoad(); }, backoff);
            } else {
              fullReinit();
            }
            return;
          }

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setTimeout(() => { if (!destroyed && hls) hls.startLoad(); }, backoff);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              try { hls.recoverMediaError(); } catch {}
              break;
            default:
              fullReinit();
              break;
          }
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => { reconnectAttemptRef.current = 0; });
    };

    initHls();

    // Stall watchdog — DESAIN ULANG: jangan pernah seek paksa ke live edge bila
    // masih ada buffer. Loncat ke live edge = "loncat-loncat" yang user rasakan.
    // Strategi: biarkan buffer mengalir; hanya seek bila buffer benar-benar kosong
    // dan stall berkepanjangan (>25s). Jeda kecil cukup di-nudge oleh hls.js sendiri.
    lastProgressRef.current = { time: 0, at: Date.now() };
    stallWatchdogRef.current = setInterval(() => {
      if (destroyed || !videoRef.current || !hlsRef.current) return;
      const v = videoRef.current;
      if (v.paused || v.ended || document.hidden) {
        lastProgressRef.current = { time: v.currentTime, at: Date.now() };
        return;
      }
      const now = Date.now();
      if (v.currentTime !== lastProgressRef.current.time) {
        lastProgressRef.current = { time: v.currentTime, at: now };
        return;
      }
      const sinceStall = now - lastProgressRef.current.at;
      if (sinceStall < 12_000) return;

      // Cek apakah masih ada buffer di depan current time
      let bufferedAhead = 0;
      try {
        const b = v.buffered;
        for (let i = 0; i < b.length; i++) {
          if (v.currentTime >= b.start(i) && v.currentTime <= b.end(i) + 0.5) {
            bufferedAhead = b.end(i) - v.currentTime;
            break;
          }
        }
      } catch {}

      // Masih ada buffer ≥3s → bukan stall network. Cukup pastikan loader jalan.
      if (bufferedAhead > 3) {
        try { hlsRef.current.startLoad(v.currentTime); v.play().catch(() => {}); } catch {}
        return;
      }

      // Buffer hampir habis & stall >12s → trigger reload pelan, JANGAN seek.
      try { hlsRef.current.startLoad(v.currentTime); } catch {}

      if (sinceStall > 25_000) {
        // Stall berat: coba media recovery dulu (tidak menyebabkan loncat visual).
        try { hlsRef.current.recoverMediaError(); } catch {}
      }
      if (sinceStall > 45_000) {
        // Benar-benar mati: barulah pindah ke live edge agar tidak nge-freeze permanen.
        try {
          if (hlsRef.current.liveSyncPosition) {
            v.currentTime = hlsRef.current.liveSyncPosition;
          }
          v.play().catch(() => {});
        } catch {}
      }
      if (sinceStall > 75_000) {
        // Last resort — full reinit
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
        hlsInitRef.current = false;
        if (!destroyed) initHls();
        lastProgressRef.current = { time: v.currentTime, at: now };
      }
    }, 4_000);

    // Auto-recover on network reconnect
    const onOnline = () => {
      if (destroyed || !hlsRef.current) return;
      try { hlsRef.current.startLoad(); } catch {}
    };
    window.addEventListener("online", onOnline);

    return () => {
      destroyed = true;
      videoRef.current?.removeEventListener("playing", markPlaybackSmooth);
      videoRef.current?.removeEventListener("canplay", markPlaybackSmooth);
      videoRef.current?.removeEventListener("playing", onPlayingClear);
      videoRef.current?.removeEventListener("timeupdate", onPlayingClear);
      videoRef.current?.removeEventListener("waiting", onWaiting);
      videoRef.current?.removeEventListener("stalled", onWaiting);
      clearTimeout(bufferingTimerRef.current);
      clearInterval(stallWatchdogRef.current);
      window.removeEventListener("online", onOnline);
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [playlist.type, hlsSourceIdentity, autoPlay, obfuscate, deobfuscate, isSlowConnection]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (playlist.type !== "youtube") return;

    let destroyed = false;

    const loadYTApi = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        createYTPlayer();
        return;
      }
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      (window as any).onYouTubeIframeAPIReady = () => {
        if (!destroyed) createYTPlayer();
      };
    };

    const createYTPlayer = () => {
      if (destroyed) return;
      const container = ytContainerRef.current;
      if (!container) return;
      container.innerHTML = "";
      const playerDiv = document.createElement("div");
      playerDiv.id = `_p${Math.random().toString(36).slice(2, 10)}`;
      container.appendChild(playerDiv);

      const _decrypted = decryptUrl(playlist.url);
      const _raw = (() => {
        const match = _decrypted.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : _decrypted;
      })();
      const _enc = obfuscate(_raw);
      const videoId = deobfuscate(_enc);

      try {
        ytPlayerRef.current = new (window as any).YT.Player(playerDiv, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            mute: readUserUnmuted() ? 0 : 1,
            enablejsapi: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
            showinfo: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e: any) => {
              if (destroyed) return;
              ytReadyRef.current = true;
              let qualityReleased = false;
              const releaseQuality = () => {
                if (qualityReleased || destroyed) return;
                qualityReleased = true;
                try {
                  if (ytPlayerRef.current && typeof ytPlayerRef.current.setPlaybackQuality === 'function') {
                    ytPlayerRef.current.setPlaybackQuality('default');
                  }
                } catch {}
              };

              try {
                const ytQuals = e.target.getAvailableQualityLevels?.() || [];
                if (ytQuals.length > 0) {
                  e.target.setPlaybackQuality(ytQuals[0]);
                }
              } catch {}

              const fallbackTimer = setTimeout(releaseQuality, 8000);
              (e.target as any).__releaseQuality = releaseQuality;
              (e.target as any).__fallbackTimer = fallbackTimer;

              try {
                const iframe = container.querySelector("iframe");
                if (iframe) {
                  iframe.removeAttribute("title");
                  iframe.setAttribute("referrerpolicy", "no-referrer");
                }
              } catch {}

              // Restore unmute preference across playlist switches.
              if (readUserUnmuted()) {
                try {
                  e.target.unMute?.();
                  e.target.setVolume?.(100);
                  setYtMuted(false);
                } catch {}
              }

              if (autoPlay) e.target.playVideo();
            },
            onStateChange: (e: any) => {
              if (destroyed) return;
              const state = e.data;
              setIsPlaying(state === 1);

              if (state === 1 || state === 2) {
                setIsLoading(false);
              }

              // If buffering lasts >4s, release quality lock early
              if (state === 3) {
                const bufferTimeout = setTimeout(() => {
                  if (destroyed) return;
                  try {
                    const p = ytPlayerRef.current;
                    if (p && typeof p.getPlayerState === "function" && p.getPlayerState() === 3) {
                      (p as any).__releaseQuality?.();
                    }
                  } catch {}
                }, 4000);
                (e.target as any).__bufferTimeout = bufferTimeout;
              } else {
                clearTimeout((e.target as any).__bufferTimeout);
              }
            },
            onError: (e: any) => {
              if (destroyed) return;
              console.warn("YT Player error code:", e.data);
              setIsLoading(false);
            },
          },
        });
      } catch (err) {
        console.warn("Failed to create YT player:", err);
        setIsLoading(false);
      }
    };

    loadYTApi();

    return () => {
      destroyed = true;
      ytReadyRef.current = false;
      try {
        if (ytPlayerRef.current?.destroy) {
          ytPlayerRef.current.destroy();
        }
      } catch {}
      ytPlayerRef.current = null;
    };
  }, [playlist, autoPlay, decryptUrl, obfuscate, deobfuscate]);

  // Cloudflare loading + auto-reconnect on network/visibility
  useEffect(() => {
    if (playlist.type !== "cloudflare") return;
    const timer = setTimeout(() => setIsLoading(false), 2000);
    let lastReload = Date.now();
    const reload = () => {
      // Throttle reloads to max 1 per 10s
      if (Date.now() - lastReload < 10_000) return;
      lastReload = Date.now();
      setCloudflareKey((k) => k + 1);
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 2000);
    };
    const onOnline = () => reload();
    const onVisible = () => { if (!document.hidden) reload(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [playlist]);

  // Click on video surface only toggles control visibility — never play/pause.
  const handleSurfaceClick = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowControls((prev) => !prev);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    if (playlist.type === "youtube") {
      const player = ytPlayerRef.current;
      if (!player || !ytReadyRef.current) return;
      try {
        const state = typeof player.getPlayerState === "function" ? player.getPlayerState() : -1;
        if (state === 1 || state === 3) {
          player.pauseVideo();
          setIsPlaying(false);
        } else {
          try {
            const duration = typeof player.getDuration === "function" ? player.getDuration() : 0;
            if (duration && duration > 0) player.seekTo(duration, true);
          } catch {}
          player.playVideo();
          setIsPlaying(true);
        }
      } catch {}
    } else if (playlist.type === "cloudflare") {
      setIsPlaying(prev => !prev);
    } else if (videoRef.current) {
      const video = videoRef.current;
      if (video.paused) {
        if (playlist.type === "m3u8" && hlsRef.current?.liveSyncPosition) {
          video.currentTime = hlsRef.current.liveSyncPosition;
        }
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  }, [playlist.type]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current as any;
    if (!container) return;
    const doc = document as any;
    const inFs = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    try {
      if (inFs) {
        try { (screen.orientation as any)?.unlock?.(); } catch {}
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      } else {
        // iOS Safari: only the <video> can fullscreen
        if (video && typeof video.webkitEnterFullscreen === "function" && !container.requestFullscreen) {
          video.webkitEnterFullscreen();
        } else if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        }
        // Lock landscape only on touch devices that support it
        const isCoarse = window.matchMedia("(pointer: coarse)").matches;
        const orientation: any = (screen as any).orientation;
        if (isCoarse && orientation && typeof orientation.lock === "function") {
          orientation.lock("landscape").catch(() => {});
        }
      }
    } catch {}
  }, []);

  const toggleOrientation = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current as any;
    const doc = document as any;
    const orientation: any = (screen as any).orientation;
    const inFs = !!(document.fullscreenElement || doc.webkitFullscreenElement);

    // 1) Try native Screen Orientation API (mobile Chrome/Edge/Firefox).
    //    Spec requires fullscreen first — enter it if needed.
    if (orientation && typeof orientation.lock === "function" && container) {
      try {
        if (!inFs) {
          if (container.requestFullscreen) await container.requestFullscreen();
          else if ((container as any).webkitRequestFullscreen) (container as any).webkitRequestFullscreen();
          else if (video && typeof video.webkitEnterFullscreen === "function") video.webkitEnterFullscreen();
        }
        const isPortrait = orientation.type?.includes("portrait");
        await orientation.lock(isPortrait ? "landscape" : "portrait");
        return;
      } catch {
        // fall through to CSS fallback
      }
    }

    // 2) CSS fallback for desktop browsers and Safari iPad/iOS that don't
    //    expose orientation.lock — rotate the container 90deg in fullscreen.
    setForcedLandscape((prev) => {
      const next = !prev;
      try {
        if (next && !inFs && container) {
          if (container.requestFullscreen) container.requestFullscreen().catch(() => {});
          else if ((container as any).webkitRequestFullscreen) (container as any).webkitRequestFullscreen();
        } else if (!next && inFs) {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
          else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        }
      } catch {}
      return next;
    });
  }, []);

  const handleQualityChange = useCallback((index: number, ytKey?: string) => {
    if (playlist.type === "youtube" && isYTReady() && ytKey) {
      try {
        ytPlayerRef.current.setPlaybackQuality(ytKey === "auto" ? "default" : ytKey);
        setCurrentQuality(index);
      } catch {}
    } else if (hlsRef.current) {
      setIsSwitchingQuality(true);
      setPendingQuality(index);
      try {
        if (index === -1) {
          writeStoredM3u8Quality({ mode: "auto" });
          hlsRef.current.currentLevel = -1;
          hlsRef.current.nextLevel = -1;
          hlsRef.current.loadLevel = -1;
        } else {
          const selectedLevel = hlsRef.current.levels?.[index];
          writeStoredM3u8Quality({
            mode: "manual",
            height: selectedLevel?.height ?? null,
            bitrate: selectedLevel?.bitrate ?? null,
            label: getLevelLabel(selectedLevel),
          });
          hlsRef.current.nextLevel = index;
          hlsRef.current.currentLevel = index;
          hlsRef.current.loadLevel = index;
        }
      } catch {}
      setCurrentQuality(index);
      // Fallback: revert pending state if LEVEL_SWITCHED never fires
      clearTimeout(qualitySwitchTimerRef.current);
      qualitySwitchTimerRef.current = setTimeout(() => {
        setIsSwitchingQuality(false);
        setPendingQuality(null);
        try {
          const cur = hlsRef.current?.currentLevel;
          if (typeof cur === "number" && cur >= 0) {
            const lvl = hlsRef.current?.levels?.[cur];
            setActiveHeight(lvl?.height ?? null);
            setCurrentQuality(cur);
          }
        } catch {}
      }, 5000);
    }
    setShowQualityMenu(false);
  }, [playlist.type, isYTReady]);

  // Close quality menu on outside click
  useEffect(() => {
    if (!showQualityMenu) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-quality-menu]")) setShowQualityMenu(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showQualityMenu]);

  const toggleYtMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isYTReady()) return;
    const player = ytPlayerRef.current;
    try {
      if (player.isMuted()) {
        player.unMute();
        player.setVolume?.(100);
        setYtMuted(false);
        writeUserUnmuted(true);
      } else {
        player.mute();
        setYtMuted(true);
        writeUserUnmuted(false);
      }
    } catch {}
  }, [isYTReady]);

  // Unified "tap to unmute" — works for HLS <video> and YouTube.
  // Persists the choice so switching playlists keeps audio on.
  const handleUnmuteAll = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    writeUserUnmuted(true);
    const v = videoRef.current;
    if (v) {
      try {
        v.muted = false;
        if (v.volume === 0) v.volume = 1;
        if (v.paused) v.play().catch(() => {});
        setVideoMuted(false);
      } catch {}
    }
    if (playlist.type === "youtube" && isYTReady()) {
      try {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume?.(100);
        ytPlayerRef.current.playVideo?.();
        setYtMuted(false);
      } catch {}
    }
  }, [playlist.type, isYTReady]);

  // Track <video> mute state changes (user might unmute via native controls)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onVol = () => {
      const muted = v.muted || v.volume === 0;
      setVideoMuted(muted);
      if (!muted) writeUserUnmuted(true);
    };
    v.addEventListener("volumechange", onVol);
    return () => v.removeEventListener("volumechange", onVol);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const doc = document as any;
      const fs = !!(document.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(fs);
      if (!fs) setForcedLandscape(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // Memoize Cloudflare iframe src to prevent re-renders
  const cloudflareSrc = useMemo(() => {
    if (playlist.type !== "cloudflare") return "";
    return `https://customer-${playlist.url}.cloudflarestream.com/iframe`;
  }, [playlist.type, playlist.url]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-card overflow-hidden ${isFullscreen ? "flex items-center justify-center !h-screen" : "aspect-video"} ${forcedLandscape ? "force-landscape" : ""}`}
    >
      {/* Loading overlay — animasi kaya supaya pengguna tahu live sedang terhubung */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-background/80 backdrop-blur-sm">
          {/* Pulsing aura */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-72 w-72 rounded-full bg-primary/10 blur-3xl animate-pulse" />
          </div>
          <div className="relative flex flex-col items-center gap-4 tv:gap-6">
            {/* Multi-ring spinner */}
            <div className="relative h-20 w-20 tv:h-28 tv:w-28">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <div
                className="absolute inset-2 rounded-full border-2 border-primary/60 border-b-transparent animate-spin"
                style={{ animationDuration: "1.6s", animationDirection: "reverse" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
              </div>
            </div>
            {/* Status text — berputar */}
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground tv:text-xl">
                {["Menghubungkan ke streaming…","Menyiapkan kualitas terbaik…","Memuat live show…","Hampir siap, mohon tunggu…"][loadingPhase]}
              </p>
              {/* Animated dots */}
              <div className="flex items-center gap-1.5 mt-1">
                {[0,1,2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              {isSlowConnection && (
                <p className="mt-2 text-[10px] text-muted-foreground tv:text-xs">
                  Mode hemat data aktif — kami pilih kualitas paling lancar untuk Anda
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Buffering pill — kecil, tidak menutupi player, muncul saat re-buffer */}
      {!isLoading && isBuffering && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-md ring-1 ring-border animate-in fade-in zoom-in-95 duration-200 tv:top-6 tv:right-6 tv:text-base tv:px-4 tv:py-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent tv:h-4 tv:w-4" />
          <span>Buffering…</span>
        </div>
      )}

      {/* Quality switching overlay */}
      {isSwitchingQuality && !isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/50 backdrop-blur-sm transition-opacity duration-300">
          <div className="flex flex-col items-center gap-2 tv:gap-4 rounded-xl bg-card/80 px-6 py-4 tv:px-10 tv:py-8 shadow-lg backdrop-blur">
            <div className="h-8 w-8 tv:h-12 tv:w-12 animate-spin rounded-full border-3 tv:border-4 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground tv:text-base">Mengganti resolusi...</p>
          </div>
        </div>
      )}

      {playlist.type === "youtube" && (
        <>
          <div
            ref={ytContainerRef}
            className={`w-full h-full [&>div]:!w-full [&>div]:!h-full [&>iframe]:!w-full [&>iframe]:!h-full [&>div>iframe]:!w-full [&>div>iframe]:!h-full [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!pointer-events-none ${isFullscreen ? "relative max-h-screen aspect-video" : "absolute inset-0 [&_iframe]:!absolute [&_iframe]:!inset-0"}`}
            style={{ pointerEvents: "none" }}
          />
          {/* Full overlay to block ALL YouTube UI navigation, links, and touch interaction */}
          <div
            className="absolute inset-0 z-10 cursor-pointer select-none"
            onClick={handleSurfaceClick}
            onContextMenu={(e) => e.preventDefault()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ pointerEvents: "auto", touchAction: "manipulation", WebkitUserSelect: "none", userSelect: "none" }}
          />
        </>
      )}

      {playlist.type === "m3u8" && (
        <video
          ref={videoRef}
          onClick={handleSurfaceClick}
          className={`h-full w-full object-contain cursor-pointer ${isFullscreen ? "max-h-screen" : "absolute inset-0"}`}
          playsInline
          preload="auto"
          controls={false}
        />
      )}

      {playlist.type === "cloudflare" && (
        <>
          <iframe
            key={cloudflareKey}
            src={cloudflareSrc}
            className={`h-full w-full ${isFullscreen ? "max-h-screen aspect-video" : "absolute inset-0"}`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
          />
          <div className="absolute inset-0 z-10 cursor-pointer" onClick={handleSurfaceClick} style={{ pointerEvents: "auto" }} />
        </>
      )}

      {/* Token code watermark — lazy loaded */}
      {tokenCode && (
        <Suspense fallback={null}>
          <Watermark tokenCode={tokenCode} />
        </Suspense>
      )}

      {/* Admin watermark image */}
      {watermarkUrl && (
        <div className="pointer-events-none absolute bottom-12 right-3 z-20 tv:bottom-20 tv:right-6">
          <img src={watermarkUrl} alt="" className="h-8 w-auto opacity-40 md:h-10 tv:h-16" loading="lazy" />
        </div>
      )}

      {/* Admin text watermark — transparan, sebesar player */}
      {watermarkTextEnabled && watermarkText && (
        <Suspense fallback={null}>
          <TextWatermark text={watermarkText} size={watermarkTextSize} opacity={Math.max(1, Math.min(100, watermarkTextOpacity)) / 100} />
        </Suspense>
      )}

      {/* "Aktifkan Suara" prominent overlay — appears when stream is playing muted.
          Larger, glowing, more visible than the small player control. */}
      {(() => {
        const isMutedNow = playlist.type === "youtube" ? ytMuted : videoMuted;
        if (!isMutedNow || isLoading) return null;
        return (
          <button
            type="button"
            onClick={handleUnmuteAll}
            aria-label="Aktifkan suara"
            className="absolute top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-primary px-5 py-3 text-base font-bold text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.7)] ring-4 ring-primary/30 backdrop-blur-md transition active:scale-95 hover:bg-primary/90 tv:top-8 tv:px-8 tv:py-4 tv:text-lg animate-pulse"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            <span>🔊 Aktifkan Suara</span>
          </button>
        );
      })()}

      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-nowrap items-center gap-1.5 sm:gap-2 tv:gap-4 bg-gradient-to-t from-background/85 via-background/40 to-transparent px-2 py-2 sm:px-3 sm:py-3 tv:px-6 tv:py-6 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-primary/80 text-primary-foreground backdrop-blur-sm transition active:scale-95 hover:bg-primary tv:h-14 tv:w-14"
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          )}
        </button>

        {/* YouTube volume toggle */}
        {playlist.type === "youtube" && (
          <button
            onClick={toggleYtMute}
            className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground backdrop-blur-sm transition active:scale-95 hover:bg-secondary tv:h-14 tv:w-14"
            title={ytMuted ? "Unmute" : "Mute"}
            aria-label={ytMuted ? "Unmute" : "Mute"}
          >
            {ytMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            )}
          </button>
        )}

        <div className="flex-1 min-w-0" />

        {qualities.length > 0 && (
          <div className="relative shrink-0" data-quality-menu>
            <button
              onClick={(e) => { e.stopPropagation(); setShowQualityMenu(prev => !prev); }}
              className="flex h-11 max-w-[110px] sm:max-w-none touch-manipulation items-center gap-1 rounded-full bg-secondary/80 px-3 tv:h-14 tv:px-4 text-xs tv:text-base text-secondary-foreground backdrop-blur-sm transition active:scale-95 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              tabIndex={0}
              aria-label="Pilih kualitas video"
            >
              <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              <span className="truncate">
                {currentQuality === -1
                  ? `Auto${activeHeight ? ` · ${activeHeight}p` : ""}`
                  : qualities.find(q => q.index === currentQuality)?.label || "Auto"}
              </span>
            </button>
            {showQualityMenu && (
              <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-card/95 border border-border p-1 shadow-xl backdrop-blur-md min-w-[140px] tv:min-w-[160px] max-h-[50vh] overflow-y-auto">
                {qualities.map((q) => {
                  const isActive = currentQuality === q.index;
                  const isPending = pendingQuality === q.index;
                  return (
                    <button
                      key={q.index}
                      onClick={(e) => { e.stopPropagation(); handleQualityChange(q.index, q.ytKey); }}
                      tabIndex={0}
                      className={`flex w-full min-h-[40px] items-center justify-between gap-2 rounded-md px-3 py-2 tv:px-4 tv:py-2 text-left text-xs tv:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span>{q.label}</span>
                      {isPending ? <span className="text-[10px] opacity-70">…</span> : isActive ? <span>✓</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          onClick={toggleOrientation}
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground backdrop-blur-sm transition active:scale-95 hover:bg-secondary tv:h-14 tv:w-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Rotate"
          tabIndex={0}
          aria-label="Putar layar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
        </button>

        <button
          onClick={toggleFullscreen}
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground backdrop-blur-sm transition active:scale-95 hover:bg-secondary tv:h-14 tv:w-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title={isFullscreen ? "Keluar fullscreen" : "Fullscreen"}
          tabIndex={0}
          aria-label={isFullscreen ? "Keluar fullscreen" : "Masuk fullscreen"}
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          )}
        </button>
      </div>
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
