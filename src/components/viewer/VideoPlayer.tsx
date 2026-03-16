import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
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
  const [qualities, setQualities] = useState<{ label: string; index: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (playlist.type === "youtube" && ytPlayerRef.current?.playVideo) {
        ytPlayerRef.current.playVideo();
      } else if (playlist.type === "m3u8" && hlsRef.current && videoRef.current) {
        // Seek to live edge before playing
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
      if (playlist.type === "youtube" && ytPlayerRef.current?.pauseVideo) {
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

  // Init HLS for m3u8
  useEffect(() => {
    if (playlist.type !== "m3u8" || !videoRef.current) return;

    const initHls = async () => {
      const Hls = (await import("hls.js")).default;
      if (!Hls.isSupported()) {
        videoRef.current!.src = playlist.url;
        if (autoPlay) videoRef.current!.play().catch(() => {});
        return;
      }

      const hls = new Hls({ liveSyncDurationCount: 3 });
      hlsRef.current = hls;
      hls.loadSource(playlist.url);
      hls.attachMedia(videoRef.current!);

      hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
        const levels = data.levels.map((l: any, i: number) => ({
          label: `${l.height}p`,
          index: i,
        }));
        setQualities([{ label: "Auto", index: -1 }, ...levels]);
        if (data.levels.length > 0) {
          hls.currentLevel = data.levels.length - 1;
          setCurrentQuality(data.levels.length - 1);
        }
        setIsLoading(false);
        if (autoPlay) {
          videoRef.current!.play().catch(() => {});
          setIsPlaying(true);
        }
      });

      hls.on(Hls.Events.ERROR, () => {
        setIsLoading(false);
      });
    };

    initHls();
  }, [playlist, autoPlay]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (playlist.type !== "youtube") return;

    const loadYTApi = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        createYTPlayer();
        return;
      }
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      (window as any).onYouTubeIframeAPIReady = createYTPlayer;
    };

    const createYTPlayer = () => {
      const container = ytContainerRef.current;
      if (!container) return;
      // Create a fresh div for YT to replace, so React doesn't manage it
      container.innerHTML = "";
      const playerDiv = document.createElement("div");
      container.appendChild(playerDiv);

      ytPlayerRef.current = new (window as any).YT.Player(playerDiv, {
        width: "100%",
        height: "100%",
        videoId: extractYTId(playlist.url),
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            const qualities = e.target.getAvailableQualityLevels();
            if (qualities && qualities.length > 0) {
              e.target.setPlaybackQuality(qualities[0]);
            }
            setIsLoading(false);
            if (autoPlay) {
              e.target.playVideo();
            }
          },
          onStateChange: (e: any) => {
            setIsPlaying(e.data === 1);
            if (e.data === 3) setIsLoading(true); // buffering
            if (e.data === 1) setIsLoading(false); // playing
          },
        },
      });
    };

    loadYTApi();

    return () => {
      if (ytPlayerRef.current?.destroy) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
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

  const togglePlay = () => {
    if (playlist.type === "youtube" && ytPlayerRef.current) {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
      } else {
        ytPlayerRef.current.playVideo();
      }
    } else if (videoRef.current) {
      if (videoRef.current.paused) {
        // Seek to live edge on unpause for m3u8
        if (playlist.type === "m3u8" && hlsRef.current?.liveSyncPosition) {
          videoRef.current.currentTime = hlsRef.current.liveSyncPosition;
        }
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
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
      hlsRef.current.currentLevel = index;
      setCurrentQuality(index);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full bg-card overflow-hidden" style={{ paddingBottom: "56.25%", height: 0 }}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground animate-pulse">Menghubungkan ke streaming...</p>
          </div>
        </div>
      )}

      {playlist.type === "youtube" && (
        <>
          <div
            id="yt-player"
            className="absolute inset-0 w-full h-full [&>iframe]:!w-full [&>iframe]:!h-full [&>iframe]:!absolute [&>iframe]:!inset-0"
          />
          <div className="absolute inset-0 z-10" style={{ pointerEvents: "auto" }} />
        </>
      )}

      {playlist.type === "m3u8" && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
        />
      )}

      {playlist.type === "cloudflare" && (
        <>
          <iframe
            src={`https://customer-${playlist.url}.cloudflarestream.com/iframe`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
          <div className="absolute inset-0 z-10" style={{ pointerEvents: "auto" }} />
        </>
      )}

      {/* Token code watermark */}
      {tokenCode && <Watermark tokenCode={tokenCode} />}

      {/* Admin watermark image */}
      {watermarkUrl && (
        <div className="pointer-events-none absolute bottom-12 right-3 z-20">
          <img src={watermarkUrl} alt="" className="h-8 w-auto opacity-40 md:h-10" />
        </div>
      )}

      {/* Custom controls overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-background/80 to-transparent p-3 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
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
            className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
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
