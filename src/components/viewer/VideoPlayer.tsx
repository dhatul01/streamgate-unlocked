import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from "react";
import Watermark from "@/components/viewer/Watermark";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper: check if YT player API is usable
  const isYTReady = () => {
    const p = ytPlayerRef.current;
    return p && ytReadyRef.current && typeof p.getPlayerState === "function" && typeof p.playVideo === "function";
  };

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
  }));

  // Hide controls after 3s
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };
    const el = containerRef.current;
    el?.addEventListener("mousemove", resetTimer);
    el?.addEventListener("touchstart", resetTimer);
    resetTimer();
    return () => {
      clearTimeout(timeout);
      el?.removeEventListener("mousemove", resetTimer);
      el?.removeEventListener("touchstart", resetTimer);
    };
  }, []);

  // Cleanup HLS on unmount or playlist change
  useEffect(() => {
    setIsLoading(true);
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playlist]);

  // Obfuscate helper: encode/decode video source at runtime
  const obfuscate = (str: string) => btoa(unescape(encodeURIComponent(str)));
  const deobfuscate = (str: string) => decodeURIComponent(escape(atob(str)));

  // Init HLS for m3u8
  useEffect(() => {
    if (playlist.type !== "m3u8" || !videoRef.current) return;

    const initHls = async () => {
      const Hls = (await import("hls.js")).default;
      // Decode URL at runtime only
      const decodedUrl = deobfuscate(obfuscate(playlist.url));
      if (!Hls.isSupported()) {
        videoRef.current!.src = decodedUrl;
        if (autoPlay) videoRef.current!.play().catch(() => {});
        return;
      }

      const hls = new Hls({
        liveSyncDurationCount: 3,
        // Prevent URL leaking in error logs
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
          set: (v) => origSrc?.set?.call(videoEl, v),
          configurable: true,
        });
        Object.defineProperty(videoEl, 'currentSrc', {
          get: () => '',
          configurable: true,
        });
      } catch {}

      hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
        const levels = data.levels.map((l: any, i: number) => ({
          label: `${l.height}p`,
          index: i,
        }));
        setQualities([{ label: "Auto", index: -1 }, ...levels]);
        // Default to Auto (-1) for adaptive bitrate
        hls.currentLevel = -1;
        setCurrentQuality(-1);
        setIsLoading(false);
        if (autoPlay) {
          videoRef.current!.play().catch(() => {});
          setIsPlaying(true);
        }
      });

      // Show loading when level is switching
      hls.on(Hls.Events.LEVEL_SWITCHING, () => {
        setIsSwitchingQuality(true);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        setIsSwitchingQuality(false);
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsSwitchingQuality(false);
      });

      hls.on(Hls.Events.ERROR, () => {
        setIsLoading(false);
        setIsSwitchingQuality(false);
      });
    };

    initHls();
  }, [playlist, autoPlay]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (playlist.type !== "youtube") return;

    let destroyed = false;

    const loadYTApi = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        createYTPlayer();
        return;
      }
      // Avoid duplicate script tags
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

      const videoId = extractYTId(playlist.url);

      try {
        ytPlayerRef.current = new (window as any).YT.Player(playerDiv, {
          width: "100%",
          height: "100%",
          videoId,
          host: "https://www.youtube.com",
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            enablejsapi: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
          },
          events: {
            onReady: (e: any) => {
              if (destroyed) return;
              ytReadyRef.current = true;
              setIsLoading(false);
              if (autoPlay) {
                e.target.playVideo();
              }
            },
            onStateChange: (e: any) => {
              if (destroyed) return;
              // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
              setIsPlaying(e.data === 1);
              setIsLoading(e.data === 3);
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
  }, [playlist, autoPlay]);

  // Cloudflare loading
  useEffect(() => {
    if (playlist.type === "cloudflare") {
      const timer = setTimeout(() => setIsLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [playlist]);

  const extractYTId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : url;
  };

  const youtubeEmbedUrl = useMemo(() => {
    if (playlist.type !== "youtube") return "";
    const videoId = extractYTId(playlist.url);
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&controls=0&rel=0&modestbranding=1`;
  }, [playlist.type, playlist.url]);
  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    if (playlist.type === "youtube") {
      const player = ytPlayerRef.current;
      if (!player || !ytReadyRef.current) {
        console.warn("[VideoPlayer] YT player not ready, ytReadyRef:", ytReadyRef.current);
        return;
      }
      try {
        // Always use actual YT player state, not React state
        const state = typeof player.getPlayerState === "function" ? player.getPlayerState() : -1;
        console.log("[VideoPlayer] YT state:", state, "isPlaying:", isPlaying);
        
        if (state === 1 || state === 3) {
          // Playing or buffering → pause
          player.pauseVideo();
          setIsPlaying(false);
        } else {
          // Paused, ended, unstarted, cued → play
          try {
            const duration = typeof player.getDuration === "function" ? player.getDuration() : 0;
            if (duration && duration > 0) {
              player.seekTo(duration, true);
            }
          } catch {}
          player.playVideo();
          setIsPlaying(true);
        }
      } catch (err) {
        console.warn("[VideoPlayer] togglePlay YT error:", err);
      }
    } else if (playlist.type === "cloudflare") {
      // Cloudflare uses iframe, toggle state only
      setIsPlaying(!isPlaying);
    } else if (videoRef.current) {
      // m3u8 or other HTML5 video — use actual paused state
      const video = videoRef.current;
      console.log("[VideoPlayer] video.paused:", video.paused, "isPlaying:", isPlaying);
      
      if (video.paused) {
        if (playlist.type === "m3u8" && hlsRef.current?.liveSyncPosition) {
          video.currentTime = hlsRef.current.liveSyncPosition;
        }
        video.play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("[VideoPlayer] play() failed:", err);
            setIsPlaying(false);
          });
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch {}
  };

  const toggleOrientation = async () => {
    try {
      const orientation = screen.orientation;
      if (orientation.type.includes("portrait")) {
        await (orientation as any).lock("landscape");
      } else {
        await (orientation as any).lock("portrait");
      }
    } catch {}
  };

  const handleQualityChange = (index: number) => {
    if (hlsRef.current) {
      setIsSwitchingQuality(true);
      hlsRef.current.currentLevel = index;
      setCurrentQuality(index);
    }
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

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
          {/* Overlay to block iframe inspection & handle play/pause click */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={(e) => togglePlay(e)}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div
            className="absolute inset-0 z-[9] bg-transparent pointer-events-none"
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
            src={`https://customer-${playlist.url}.cloudflarestream.com/iframe`}
            className={`h-full w-full ${isFullscreen ? "max-h-screen aspect-video" : "absolute inset-0"}`}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
          <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} style={{ pointerEvents: "auto" }} />
        </>
      )}

      {/* Token code watermark */}
      {tokenCode && <Watermark tokenCode={tokenCode} />}

      {/* Admin watermark image */}
      {watermarkUrl && (
        <div className="pointer-events-none absolute bottom-12 right-3 z-20 tv:bottom-20 tv:right-6">
          <img src={watermarkUrl} alt="" className="h-8 w-auto opacity-40 md:h-10 tv:h-16" />
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
          onClick={(e) => togglePlay(e)}
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
