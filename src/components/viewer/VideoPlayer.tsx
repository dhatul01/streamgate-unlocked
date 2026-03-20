import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback, lazy, Suspense } from "react";

const Watermark = lazy(() => import("@/components/viewer/Watermark"));

interface VideoPlayerProps {
  playlist: {
    type: string;
    url: string;
    label: string;
  };
  autoPlay?: boolean;
  watermarkUrl?: string;
  tokenCode?: string;
}

export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({ playlist, autoPlay = true, watermarkUrl, tokenCode }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingQuality, setIsSwitchingQuality] = useState(false);
  const [qualities, setQualities] = useState<{ label: string; index: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hlsInitRef = useRef(false);

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
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playlist]);

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

  // Init HLS for m3u8 — optimized with memory management
  useEffect(() => {
    if (playlist.type !== "m3u8" || !videoRef.current || hlsInitRef.current) return;
    hlsInitRef.current = true;

    let destroyed = false;
    let hls: any = null;

    const initHls = async () => {
      const Hls = (await import("hls.js")).default;
      if (destroyed) return;

      const decodedUrl = deobfuscate(obfuscate(playlist.url));
      if (!Hls.isSupported()) {
        videoRef.current!.src = decodedUrl;
        if (autoPlay) videoRef.current!.play().catch(() => {});
        return;
      }

      hls = new Hls({
        // Live stream tuning
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        liveDurationInfinity: true,
        // Optimized buffer settings for 1000+ concurrent viewers
        // Lower buffers reduce memory per client while maintaining smooth playback
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        maxBufferSize: 30 * 1000 * 1000, // 30MB (reduced from 60MB)
        maxBufferHole: 0.5,
        // Backbuffer trimming — critical for memory management in long streams
        backBufferLength: 30, // Only keep 30s of past content
        // ABR settings
        abrEwmaDefaultEstimate: 1_000_000,
        abrBandWidthFactor: 0.9,
        abrBandWidthUpFactor: 0.7,
        // Recovery & retry — with exponential backoff
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1500,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        // Faster start
        startFragPrefetch: true,
        testBandwidth: true,
        progressive: true,
        lowLatencyMode: false,
        debug: false,
      });

      hlsRef.current = hls;
      hls.loadSource(decodedUrl);
      hls.attachMedia(videoRef.current!);

      // Override video src property to hide URL from DOM inspection
      try {
        const videoEl = videoRef.current!;
        const origSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
        Object.defineProperty(videoEl, 'src', {
          get: () => '',
          set: (v: string) => origSrc?.set?.call(videoEl, v),
          configurable: true,
        });
        Object.defineProperty(videoEl, 'currentSrc', {
          get: () => '',
          configurable: true,
        });
      } catch {}

      hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
        if (destroyed) return;
        const levels = data.levels.map((l: any, i: number) => ({
          label: `${l.height}p`,
          index: i,
        }));
        setQualities([{ label: "Auto", index: -1 }, ...levels]);
        hls.currentLevel = -1;
        setCurrentQuality(-1);
        setIsLoading(false);
        if (autoPlay) {
          videoRef.current!.play().catch(() => {});
          setIsPlaying(true);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHING, () => {
        if (!destroyed) setIsSwitchingQuality(true);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        if (!destroyed) setIsSwitchingQuality(false);
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (!destroyed) setIsSwitchingQuality(false);
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (destroyed) return;
        setIsLoading(false);
        setIsSwitchingQuality(false);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              hlsInitRef.current = false;
              // Reinit after delay
              setTimeout(() => {
                if (!destroyed) initHls();
              }, 3000);
              break;
          }
        }
      });
    };

    initHls();

    return () => {
      destroyed = true;
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [playlist, autoPlay, obfuscate, deobfuscate]);

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
            mute: 0,
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
              try {
                const qualities = e.target.getAvailableQualityLevels?.();
                if (qualities && qualities.length > 0) {
                  const highest = qualities[0];
                  e.target.setPlaybackQuality(highest);
                  e.target.setPlaybackQualityRange?.(highest, highest);
                }
              } catch {}

              try {
                const iframe = container.querySelector("iframe");
                if (iframe) {
                  iframe.removeAttribute("title");
                  iframe.setAttribute("referrerpolicy", "no-referrer");
                  // Remove allow attribute to prevent link navigation
                  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
                }
              } catch {}

              // Keep loading overlay visible until video actually starts playing
              // This hides the channel name / title card that YouTube shows briefly
              if (autoPlay) e.target.playVideo();
            },
            onStateChange: (e: any) => {
              if (destroyed) return;
              const state = e.data;
              // 1 = playing, 2 = paused, 3 = buffering
              setIsPlaying(state === 1);
              // Only hide loading when video is actually playing — this keeps
              // the overlay visible during the brief YouTube title/channel card
              if (state === 1 || state === 2) {
                setIsLoading(false);
              } else if (state === 3) {
                // Don't show loading for brief buffering if already loaded once
                // (prevents flicker during quality changes)
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

  // Cloudflare loading
  useEffect(() => {
    if (playlist.type === "cloudflare") {
      const timer = setTimeout(() => setIsLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [playlist]);

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
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch {}
  }, []);

  const toggleOrientation = useCallback(async () => {
    try {
      const orientation = screen.orientation;
      if (orientation.type.includes("portrait")) {
        await (orientation as any).lock("landscape");
      } else {
        await (orientation as any).lock("portrait");
      }
    } catch {}
  }, []);

  const handleQualityChange = useCallback((index: number) => {
    if (hlsRef.current) {
      setIsSwitchingQuality(true);
      hlsRef.current.currentLevel = index;
      setCurrentQuality(index);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Memoize Cloudflare iframe src to prevent re-renders
  const cloudflareSrc = useMemo(() => {
    if (playlist.type !== "cloudflare") return "";
    return `https://customer-${playlist.url}.cloudflarestream.com/iframe`;
  }, [playlist.type, playlist.url]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-card overflow-hidden ${isFullscreen ? "flex items-center justify-center !h-screen" : "aspect-video"}`}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-3 tv:gap-5">
            <div className="h-10 w-10 tv:h-16 tv:w-16 animate-spin rounded-full border-4 tv:border-[6px] border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground animate-pulse tv:text-lg">Menghubungkan ke streaming...</p>
          </div>
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
            className={`w-full h-full [&>div]:!w-full [&>div]:!h-full [&>iframe]:!w-full [&>iframe]:!h-full [&>div>iframe]:!w-full [&>div>iframe]:!h-full [&_iframe]:!w-full [&_iframe]:!h-full ${isFullscreen ? "relative max-h-screen aspect-video" : "absolute inset-0 [&_iframe]:!absolute [&_iframe]:!inset-0"}`}
          />
          {/* Full overlay to block all YouTube UI navigation and links */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={togglePlay}
            onContextMenu={(e) => e.preventDefault()}
          />
        </>
      )}

      {playlist.type === "m3u8" && (
        <video
          ref={videoRef}
          onClick={togglePlay}
          className={`h-full w-full object-contain cursor-pointer ${isFullscreen ? "max-h-screen" : "absolute inset-0"}`}
          playsInline
        />
      )}

      {playlist.type === "cloudflare" && (
        <>
          <iframe
            src={cloudflareSrc}
            className={`h-full w-full ${isFullscreen ? "max-h-screen aspect-video" : "absolute inset-0"}`}
            allow="autoplay; fullscreen"
            allowFullScreen
            loading="lazy"
          />
          <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} style={{ pointerEvents: "auto" }} />
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

      {/* Custom controls overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 tv:gap-4 bg-gradient-to-t from-background/80 to-transparent p-3 tv:p-6 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/80 text-primary-foreground backdrop-blur-sm transition hover:bg-primary tv:h-14 tv:w-14"
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          )}
        </button>

        <div className="flex-1" />

        {playlist.type === "m3u8" && qualities.length > 0 && (
          <select
            value={currentQuality}
            onChange={(e) => handleQualityChange(Number(e.target.value))}
            className="rounded-md bg-secondary px-2 py-1 tv:px-4 tv:py-2 text-xs tv:text-base text-secondary-foreground"
          >
            {qualities.map((q) => (
              <option key={q.index} value={q.index}>{q.label}</option>
            ))}
          </select>
        )}

        <button
          onClick={toggleOrientation}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground backdrop-blur-sm transition hover:bg-secondary tv:h-14 tv:w-14"
          title="Rotate"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
        </button>

        <button
          onClick={toggleFullscreen}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground backdrop-blur-sm transition hover:bg-secondary tv:h-14 tv:w-14"
          title="Fullscreen"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
