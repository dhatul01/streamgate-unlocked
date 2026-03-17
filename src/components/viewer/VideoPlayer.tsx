import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
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

const YT_STATE_UNSTARTED = -1;
const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;
const YT_STATE_PAUSED = 2;
const YT_STATE_BUFFERING = 3;
const YT_STATE_CUED = 5;

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ playlist, autoPlay = true, watermarkUrl, tokenCode }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [qualities, setQualities] = useState<{ label: string; index: number }[]>([]);
    const [currentQuality, setCurrentQuality] = useState(-1);
    const [ytQualities, setYtQualities] = useState<string[]>([]);
    const [currentYtQuality, setCurrentYtQuality] = useState("auto");
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);
    const ytPlayerRef = useRef<any>(null);
    const ytReadyRef = useRef(false);
    const ytContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const cloudflareIframeRef = useRef<HTMLIFrameElement>(null);
    const cloudflarePlayerRef = useRef<any>(null);
    const cloudflareCleanupRef = useRef<(() => void) | null>(null);
    const playbackIntentRef = useRef<"play" | "pause">(autoPlay ? "play" : "pause");
    const playbackStateRef = useRef(false);

    const setPlayerLoading = useCallback((loading: boolean) => {
      setIsLoading(loading);
    }, []);

    const setPlayerPlaying = useCallback((playing: boolean) => {
      playbackStateRef.current = playing;
      setIsPlaying(playing);
    }, []);

    const seekNativeToLiveEdge = useCallback(() => {
      const video = videoRef.current;
      if (!video || playlist.type !== "m3u8") return;

      const liveSyncPosition = hlsRef.current?.liveSyncPosition;
      if (typeof liveSyncPosition === "number" && Number.isFinite(liveSyncPosition)) {
        try {
          video.currentTime = liveSyncPosition;
        } catch {}
      }
    }, [playlist.type]);

    const playNative = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;

      playbackIntentRef.current = "play";
      if (video.ended) {
        try {
          video.currentTime = 0;
        } catch {}
      }
      seekNativeToLiveEdge();
      setPlayerLoading(true);
      await video.play().catch(() => {
        setPlayerLoading(false);
      });
    }, [seekNativeToLiveEdge, setPlayerLoading]);

    const pauseNative = useCallback(() => {
      playbackIntentRef.current = "pause";
      setPlayerLoading(false);
      videoRef.current?.pause();
    }, [setPlayerLoading]);

    const syncYoutubePlayback = useCallback((forcedState?: number) => {
      const player = ytPlayerRef.current;
      if (!player || !ytReadyRef.current) return;

      try {
        const state = forcedState ?? player.getPlayerState?.();
        const shouldPause = playbackIntentRef.current === "pause";

        if (shouldPause) {
          if (state === YT_STATE_PLAYING || state === YT_STATE_BUFFERING) {
            player.pauseVideo?.();
          }
          return;
        }

        if (state === YT_STATE_ENDED) {
          player.seekTo?.(0, true);
        }

        if (state !== YT_STATE_PLAYING && state !== YT_STATE_BUFFERING) {
          player.playVideo?.();
        }
      } catch {}
    }, []);

    const playYoutube = useCallback(async () => {
      playbackIntentRef.current = "play";
      setPlayerLoading(true);
      syncYoutubePlayback();
    }, [setPlayerLoading, syncYoutubePlayback]);

    const pauseYoutube = useCallback(() => {
      playbackIntentRef.current = "pause";
      setPlayerLoading(false);
      syncYoutubePlayback();
    }, [setPlayerLoading, syncYoutubePlayback]);

    const playCloudflare = useCallback(async () => {
      playbackIntentRef.current = "play";
      const player = cloudflarePlayerRef.current;
      if (!player?.play) return;

      setPlayerLoading(true);
      try {
        await player.play();
      } catch {
        try {
          player.muted = true;
          await player.play();
        } catch {
          setPlayerLoading(false);
        }
      }
    }, [setPlayerLoading]);

    const pauseCloudflare = useCallback(() => {
      playbackIntentRef.current = "pause";
      setPlayerLoading(false);
      cloudflarePlayerRef.current?.pause?.();
    }, [setPlayerLoading]);

    const playCurrent = useCallback(async () => {
      if (playlist.type === "youtube") {
        await playYoutube();
        return;
      }

      if (playlist.type === "cloudflare") {
        await playCloudflare();
        return;
      }

      await playNative();
    }, [playlist.type, playYoutube, playCloudflare, playNative]);

    const pauseCurrent = useCallback(() => {
      if (playlist.type === "youtube") {
        pauseYoutube();
        return;
      }

      if (playlist.type === "cloudflare") {
        pauseCloudflare();
        return;
      }

      pauseNative();
    }, [playlist.type, pauseYoutube, pauseCloudflare, pauseNative]);

    const getCurrentPlaybackState = useCallback(() => {
      if (playlist.type === "youtube") {
        const player = ytPlayerRef.current;
        if (!player?.getPlayerState) {
          return playbackStateRef.current;
        }

        try {
          const state = player.getPlayerState();
          return state === YT_STATE_PLAYING || state === YT_STATE_BUFFERING;
        } catch {
          return playbackStateRef.current;
        }
      }

      if (playlist.type === "cloudflare") {
        return playbackStateRef.current;
      }

      const video = videoRef.current;
      return !!video && !video.paused && !video.ended;
    }, [playlist.type]);

    const togglePlay = useCallback(() => {
      if (getCurrentPlaybackState()) {
        pauseCurrent();
        return;
      }

      void playCurrent();
    }, [getCurrentPlaybackState, pauseCurrent, playCurrent]);

    useImperativeHandle(ref, () => ({
      play: () => {
        void playCurrent();
      },
      pause: () => {
        pauseCurrent();
      },
    }), [pauseCurrent, playCurrent]);

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

    useEffect(() => {
      const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", onFsChange);
      return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    useEffect(() => {
      playbackIntentRef.current = autoPlay ? "play" : "pause";
      playbackStateRef.current = false;
      setPlayerLoading(true);
      setPlayerPlaying(false);
      setQualities([]);
      setCurrentQuality(-1);
      setYtQualities([]);
      setCurrentYtQuality("auto");

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        if (ytPlayerRef.current?.destroy) {
          try {
            ytPlayerRef.current.destroy();
          } catch {}
        }
        ytPlayerRef.current = null;
        ytReadyRef.current = false;

        if (cloudflareCleanupRef.current) {
          cloudflareCleanupRef.current();
          cloudflareCleanupRef.current = null;
        }
        cloudflarePlayerRef.current = null;
      };
    }, [playlist.type, playlist.url, autoPlay, setPlayerLoading, setPlayerPlaying]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onPlay = () => setPlayerPlaying(true);
      const onPlaying = () => {
        setPlayerLoading(false);
        setPlayerPlaying(true);
      };
      const onPause = () => setPlayerPlaying(false);
      const onEnded = () => setPlayerPlaying(false);
      const onWaiting = () => setPlayerLoading(true);
      const onLoadStart = () => setPlayerLoading(true);
      const onCanPlay = () => setPlayerLoading(false);
      const onError = () => setPlayerLoading(false);

      video.addEventListener("play", onPlay);
      video.addEventListener("playing", onPlaying);
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onEnded);
      video.addEventListener("waiting", onWaiting);
      video.addEventListener("loadstart", onLoadStart);
      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("error", onError);

      return () => {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("waiting", onWaiting);
        video.removeEventListener("loadstart", onLoadStart);
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("error", onError);
      };
    }, [playlist, setPlayerLoading, setPlayerPlaying]);

    const obfuscate = (str: string) => btoa(unescape(encodeURIComponent(str)));
    const deobfuscate = (str: string) => decodeURIComponent(escape(atob(str)));

    useEffect(() => {
      if (playlist.type !== "m3u8" || !videoRef.current) return;

      const initHls = async () => {
        const Hls = (await import("hls.js")).default;
        const decodedUrl = deobfuscate(obfuscate(playlist.url));
        const video = videoRef.current;
        if (!video) return;

        video.playsInline = true;
        video.preload = "auto";

        if (!Hls.isSupported()) {
          video.src = decodedUrl;
          if (playbackIntentRef.current === "play") {
            await video.play().catch(() => {
              setPlayerLoading(false);
            });
          } else {
            setPlayerLoading(false);
          }
          return;
        }

        const hls = new Hls({
          liveSyncDurationCount: 3,
          debug: false,
        });

        hlsRef.current = hls;
        hls.loadSource(decodedUrl);
        hls.attachMedia(video);

        try {
          const origSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
          Object.defineProperty(video, "src", {
            get: () => "",
            set: (v) => origSrc?.set?.call(video, v),
            configurable: true,
          });
          Object.defineProperty(video, "currentSrc", {
            get: () => "",
            configurable: true,
          });
        } catch {}

        hls.on(Hls.Events.MANIFEST_PARSED, async (_: any, data: any) => {
          const levels = data.levels.map((l: any, i: number) => ({
            label: `${l.height}p`,
            index: i,
          }));

          setQualities([{ label: "Auto", index: -1 }, ...levels]);

          if (data.levels.length > 0) {
            hls.currentLevel = data.levels.length - 1;
            setCurrentQuality(data.levels.length - 1);
          }

          setPlayerLoading(false);

          if (playbackIntentRef.current === "play") {
            await video.play().catch(() => {
              setPlayerLoading(false);
            });
          }
        });

        hls.on(Hls.Events.ERROR, () => {
          setPlayerLoading(false);
        });
      };

      void initHls();
    }, [playlist.type, playlist.url, setPlayerLoading]);

    useEffect(() => {
      if (playlist.type !== "youtube") return;

      let destroyed = false;

      const createYTPlayer = () => {
        if (destroyed) return;
        const container = ytContainerRef.current;
        if (!container) return;

        container.innerHTML = "";
        const playerDiv = document.createElement("div");
        playerDiv.id = `_p${Math.random().toString(36).slice(2, 10)}`;
        container.appendChild(playerDiv);

        const videoId = extractYTId(playlist.url);
        const win = window as any;

        try {
          ytPlayerRef.current = new win.YT.Player(playerDiv, {
            width: "100%",
            height: "100%",
            videoId,
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
              showinfo: 0,
              iv_load_policy: 3,
              playsinline: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                if (destroyed) return;
                ytReadyRef.current = true;
                setPlayerLoading(false);

                try {
                  const iframe = ytContainerRef.current?.querySelector("iframe");
                  if (iframe) {
                    Object.defineProperty(iframe, "src", {
                      get: () => "",
                      set: (v) => iframe.setAttribute("src", v),
                      configurable: true,
                    });
                    const origGetAttr = iframe.getAttribute.bind(iframe);
                    iframe.getAttribute = (name: string) => {
                      if (name === "src") return "";
                      return origGetAttr(name);
                    };
                  }
                } catch {}

                // Force max quality before playback
                forceMaxYtQuality();

                if (playbackIntentRef.current === "play") {
                  setPlayerLoading(true);
                }
                syncYoutubePlayback();
              },
              onStateChange: (e: any) => {
                if (destroyed) return;

                if (e.data === YT_STATE_PLAYING) {
                  setPlayerLoading(false);
                  setPlayerPlaying(true);
                  // Re-detect qualities once playing (YouTube exposes them after buffering)
                  forceMaxYtQuality();
                  if (playbackIntentRef.current === "pause") {
                    requestAnimationFrame(() => syncYoutubePlayback(YT_STATE_PLAYING));
                  }
                  return;
                }

                if (e.data === YT_STATE_BUFFERING) {
                  setPlayerLoading(true);
                  setPlayerPlaying(true);
                  if (playbackIntentRef.current === "pause") {
                    requestAnimationFrame(() => syncYoutubePlayback(YT_STATE_BUFFERING));
                  }
                  return;
                }

                if (e.data === YT_STATE_PAUSED) {
                  setPlayerLoading(false);
                  setPlayerPlaying(false);
                  if (playbackIntentRef.current === "play") {
                    requestAnimationFrame(() => syncYoutubePlayback(YT_STATE_PAUSED));
                  }
                  return;
                }

                if (e.data === YT_STATE_ENDED || e.data === YT_STATE_CUED || e.data === YT_STATE_UNSTARTED) {
                  setPlayerLoading(false);
                  setPlayerPlaying(false);
                  if (playbackIntentRef.current === "play") {
                    requestAnimationFrame(() => syncYoutubePlayback(e.data));
                  }
                }
              },
              onPlaybackQualityChange: (e: any) => {
                if (destroyed) return;
                setCurrentYtQuality(e.data || "auto");
              },
              onError: () => {
                if (destroyed) return;
                setPlayerLoading(false);
                setPlayerPlaying(false);
              },
            },
          });
        } catch {
          setPlayerLoading(false);
        }
      };

      const loadYTApi = () => {
        const win = window as any;
        if (win.YT?.Player) {
          createYTPlayer();
          return;
        }

        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
        }

        win.onYouTubeIframeAPIReady = () => {
          if (!destroyed) createYTPlayer();
        };
      };

      loadYTApi();

      return () => {
        destroyed = true;
      };
    }, [playlist.type, playlist.url, setPlayerLoading, setPlayerPlaying, syncYoutubePlayback, forceMaxYtQuality]);

    useEffect(() => {
      if (playlist.type !== "cloudflare") return;

      let destroyed = false;

      const bindCloudflarePlayer = () => {
        const iframe = cloudflareIframeRef.current;
        const Stream = (window as any).Stream;
        if (!iframe || !Stream || destroyed) return;

        const player = Stream(iframe);
        cloudflarePlayerRef.current = player;

        const onPlay = () => {
          setPlayerPlaying(true);
          if (playbackIntentRef.current === "pause") {
            requestAnimationFrame(() => player.pause?.());
          }
        };
        const onPlaying = () => {
          setPlayerLoading(false);
          setPlayerPlaying(true);
          if (playbackIntentRef.current === "pause") {
            requestAnimationFrame(() => player.pause?.());
          }
        };
        const onPause = () => {
          setPlayerLoading(false);
          setPlayerPlaying(false);
        };
        const onWaiting = () => setPlayerLoading(true);
        const onLoadStart = () => setPlayerLoading(true);
        const onCanPlay = () => setPlayerLoading(false);
        const onEnded = () => {
          setPlayerLoading(false);
          setPlayerPlaying(false);
        };

        player.addEventListener?.("play", onPlay);
        player.addEventListener?.("playing", onPlaying);
        player.addEventListener?.("pause", onPause);
        player.addEventListener?.("waiting", onWaiting);
        player.addEventListener?.("loadstart", onLoadStart);
        player.addEventListener?.("canplay", onCanPlay);
        player.addEventListener?.("ended", onEnded);

        cloudflareCleanupRef.current = () => {
          player.removeEventListener?.("play", onPlay);
          player.removeEventListener?.("playing", onPlaying);
          player.removeEventListener?.("pause", onPause);
          player.removeEventListener?.("waiting", onWaiting);
          player.removeEventListener?.("loadstart", onLoadStart);
          player.removeEventListener?.("canplay", onCanPlay);
          player.removeEventListener?.("ended", onEnded);
        };

        setPlayerLoading(false);
        if (playbackIntentRef.current === "play") {
          void playCloudflare();
        }
      };

      const scriptSrc = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
      if (!(window as any).Stream) {
        if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
          const script = document.createElement("script");
          script.src = scriptSrc;
          script.async = true;
          script.onload = () => {
            if (!destroyed) bindCloudflarePlayer();
          };
          document.head.appendChild(script);
        } else {
          const existing = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement | null;
          existing?.addEventListener("load", bindCloudflarePlayer, { once: true });
        }
      } else {
        bindCloudflarePlayer();
      }

      return () => {
        destroyed = true;
      };
    }, [playlist.type, playlist.url, playCloudflare, setPlayerLoading, setPlayerPlaying]);

    const extractYTId = (url: string) => {
      // Support: youtube.com/watch?v=, youtu.be/, /embed/, /v/, /live/
      const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/|\/live\/)([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : url;
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

    const YT_QUALITY_MAP: Record<string, string> = {
      highres: "4320p",
      hd2160: "2160p",
      hd1440: "1440p",
      hd1080: "1080p",
      hd720: "720p",
      large: "480p",
      medium: "360p",
      small: "240p",
      tiny: "144p",
      auto: "Auto",
    };

    const handleYtQualityChange = (quality: string) => {
      const player = ytPlayerRef.current;
      if (!player?.setPlaybackQuality) return;

      try {
        if (quality === "auto") {
          player.setPlaybackQuality("default");
        } else {
          player.setPlaybackQuality(quality);
        }
        setCurrentYtQuality(quality);
      } catch {}
    };

    const forceMaxYtQuality = useCallback(() => {
      const player = ytPlayerRef.current;
      if (!player?.getAvailableQualityLevels) return;

      try {
        const levels: string[] = player.getAvailableQualityLevels() || [];
        if (levels.length === 0) return;

        const validLevels = levels.filter((l: string) => l !== "auto" && l !== "default");
        setYtQualities(["auto", ...validLevels]);

        // Set highest available quality
        if (validLevels.length > 0) {
          const highest = validLevels[0]; // YouTube returns highest first
          player.setPlaybackQuality(highest);
          setCurrentYtQuality(highest);
        }
      } catch {}
    }, []);

    return (
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden bg-card ${isFullscreen ? "flex items-center justify-center !h-screen" : ""}`}
        style={isFullscreen ? {} : { paddingBottom: "56.25%", height: 0 }}
      >
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-3 tv:gap-5">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent tv:h-16 tv:w-16 tv:border-[6px]" />
              <p className="animate-pulse text-xs text-muted-foreground tv:text-lg">Menghubungkan ke streaming...</p>
            </div>
          </div>
        )}

        {playlist.type === "youtube" && (
          <>
            <div
              ref={ytContainerRef}
              className={`h-full w-full [&>div]:!h-full [&>div]:!w-full [&>div>iframe]:!h-full [&>div>iframe]:!w-full [&>iframe]:!h-full [&>iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full ${isFullscreen ? "relative aspect-video max-h-screen" : "absolute inset-0 [&_iframe]:!absolute [&_iframe]:!inset-0"}`}
            />
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              onContextMenu={(e) => e.preventDefault()}
              style={{ pointerEvents: "auto" }}
            />
            <div
              className="absolute inset-0 z-[9] bg-transparent"
              onContextMenu={(e) => e.preventDefault()}
              style={{ pointerEvents: "none" }}
            />
          </>
        )}

        {playlist.type === "m3u8" && (
          <video
            ref={videoRef}
            onClick={togglePlay}
            className={`h-full w-full cursor-pointer object-contain ${isFullscreen ? "max-h-screen" : "absolute inset-0"}`}
            playsInline
            preload="auto"
          />
        )}

        {playlist.type === "cloudflare" && (
          <>
            <iframe
              ref={cloudflareIframeRef}
              src={`https://customer-${playlist.url}.cloudflarestream.com/iframe?controls=false&autoplay=false`}
              className={`h-full w-full ${isFullscreen ? "aspect-video max-h-screen" : "absolute inset-0"}`}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
            <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} style={{ pointerEvents: "auto" }} />
          </>
        )}

        {tokenCode && <Watermark tokenCode={tokenCode} />}

        {watermarkUrl && (
          <div className="pointer-events-none absolute bottom-12 right-3 z-20 tv:bottom-20 tv:right-6">
            <img src={watermarkUrl} alt="" className="h-8 w-auto opacity-40 md:h-10 tv:h-16" />
          </div>
        )}

        <div
          className={`absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-background/80 to-transparent p-3 transition-opacity tv:gap-4 tv:p-6 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/80 text-primary-foreground backdrop-blur-sm transition hover:bg-primary tv:h-14 tv:w-14"
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
            )}
          </button>

          <div className="flex-1" />

          {playlist.type === "m3u8" && qualities.length > 0 && (
            <select
              value={currentQuality}
              onChange={(e) => handleQualityChange(Number(e.target.value))}
              className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground tv:px-4 tv:py-2 tv:text-base"
            >
              {qualities.map((q) => (
                <option key={q.index} value={q.index}>{q.label}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={toggleOrientation}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground backdrop-blur-sm transition hover:bg-secondary tv:h-14 tv:w-14"
            title="Rotate"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground backdrop-blur-sm transition hover:bg-secondary tv:h-14 tv:w-14"
            title="Fullscreen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
          </button>
        </div>
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
