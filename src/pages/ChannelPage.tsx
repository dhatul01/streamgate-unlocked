import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer, { VideoPlayerHandle } from "@/components/viewer/VideoPlayer";
import LiveChat from "@/components/viewer/LiveChat";
import UsernameModal from "@/components/viewer/UsernameModal";
import Watermark from "@/components/viewer/Watermark";

const ChannelPage = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenCode = searchParams.get("token");

  const [moderator, setModerator] = useState<any>(null);
  const [stream, setStream] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [chatUsername, setChatUsername] = useState("");
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [watermarkUrl, setWatermarkUrl] = useState("");
  const [nextShowTime, setNextShowTime] = useState("");
  const [countdown, setCountdown] = useState("");
  const playerRef = useRef<VideoPlayerHandle>(null);

  useEffect(() => {
    const init = async () => {
      // Fetch moderator profile
      const { data: mod } = await supabase
        .from("moderators")
        .select("*")
        .eq("username", username)
        .eq("is_active", true)
        .single();

      if (!mod) {
        setError("Channel tidak ditemukan");
        setLoading(false);
        return;
      }
      setModerator(mod);

      // Validate token if provided
      if (tokenCode) {
        const { data } = await supabase.rpc("validate_token", { _code: tokenCode });
        const result = data as any;
        if (result?.valid) {
          setTokenValid(true);
        } else {
          setError(result?.error || "Token tidak valid");
          setLoading(false);
          return;
        }
      } else {
        // No token required for channel pages - they can view freely
        setTokenValid(true);
      }

      // Fetch stream, playlists, and site settings
      const [streamRes, playlistRes, settingsRes] = await Promise.all([
        supabase.from("streams").select("*").limit(1).single(),
        supabase.rpc("get_playlists_for_channel", { _moderator_username: username! }),
        supabase.from("site_settings").select("*"),
      ]);

      setStream(streamRes.data);
      const list = (playlistRes.data || []) as any[];
      setPlaylists(list);
      if (list.length > 0) setActivePlaylist(list[0]);

      if (settingsRes.data) {
        settingsRes.data.forEach((s: any) => {
          if (s.key === "watermark_image_url" && s.value) setWatermarkUrl(s.value);
          if (s.key === "next_show_time" && s.value) setNextShowTime(s.value);
        });
      }

      // Check username
      const savedUsername = localStorage.getItem(`channel_username_${username}`);
      if (savedUsername) {
        setChatUsername(savedUsername);
      } else {
        setShowUsernameModal(true);
      }

      setLoading(false);
    };
    init();
  }, [username, tokenCode]);

  // Realtime: streams
  useEffect(() => {
    const channel = supabase
      .channel("channel-stream-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "streams" },
        (payload: any) => {
          setStream(payload.new);
          if (payload.new.is_live && !payload.old?.is_live) {
            setTimeout(() => {
              playerRef.current?.play();
            }, 500);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime: playlists
  useEffect(() => {
    const channel = supabase
      .channel("channel-playlist-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlists" },
        async () => {
          if (!username) return;
          const { data } = await supabase.rpc("get_playlists_for_channel", { _moderator_username: username });
          const list = (data || []) as any[];
          setPlaylists(list);
          if (list.length > 0 && !activePlaylist) {
            setActivePlaylist(list[0]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [username, activePlaylist]);

  // Realtime: site_settings
  useEffect(() => {
    const channel = supabase
      .channel("channel-settings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings" },
        (payload: any) => {
          const row = payload.new;
          if (row?.key === "watermark_image_url") setWatermarkUrl(row.value || "");
          if (row?.key === "next_show_time") setNextShowTime(row.value || "");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!nextShowTime || stream?.is_live) {
      setCountdown("");
      return;
    }

    const target = new Date(nextShowTime).getTime();
    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setCountdown("");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextShowTime, stream?.is_live]);

  // Disable right-click on player area
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".player-area")) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  const handlePlaylistSwitch = useCallback((p: any) => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setActivePlaylist(p);
  }, []);

  const handleUsernameSet = (name: string) => {
    setChatUsername(name);
    localStorage.setItem(`channel_username_${username}`, name);
    setShowUsernameModal(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#1a1a2e" }}>
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" />
          <p className="mt-3 text-xs text-white/50 animate-pulse">Memuat channel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">😕</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const bgColor = moderator?.background_color || "#1a1a2e";
  const isLive = stream?.is_live || false;

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3 tv:px-8 tv:py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            {moderator?.logo_url ? (
              <img src={moderator.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-cover tv:h-12 tv:w-12" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white tv:h-12 tv:w-12 tv:text-lg">
                {(moderator?.site_name || "C").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-white tv:text-2xl">
                {moderator?.site_name || "Channel"}
              </h1>
              {stream?.description && (
                <p className="text-xs text-white/50 tv:text-sm">{stream.description}</p>
              )}
            </div>
          </div>
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400 tv:px-4 tv:py-1.5 tv:text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/50 tv:px-4 tv:py-1.5 tv:text-sm">
              OFFLINE
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl p-4 tv:p-8">
        <div className="grid gap-4 lg:grid-cols-3 tv:gap-6">
          {/* Player */}
          <div className="lg:col-span-2 space-y-3">
            <div className="player-area relative rounded-xl overflow-hidden border border-white/10">
              {isLive && activePlaylist ? (
                <VideoPlayer
                  ref={playerRef}
                  playlist={activePlaylist}
                  autoPlay
                  watermarkUrl={watermarkUrl}
                  tokenCode={tokenCode || undefined}
                />
              ) : (
                <div className="relative flex aspect-video w-full flex-col items-center justify-center bg-black/40">
                  {moderator?.logo_url ? (
                    <img src={moderator.logo_url} alt="" className="mb-4 h-16 w-16 tv:h-28 tv:w-28 opacity-30 rounded-lg" />
                  ) : (
                    <div className="mb-4 flex h-16 w-16 tv:h-28 tv:w-28 items-center justify-center rounded-lg bg-white/5 text-2xl tv:text-5xl font-bold text-white/20">
                      {(moderator?.site_name || "C").charAt(0).toUpperCase()}
                    </div>
                  )}
                  {countdown ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-white/50 tv:text-xl">Show dimulai dalam</p>
                      <p className="mt-2 font-mono text-4xl font-bold text-white lg:text-5xl tv:text-7xl">{countdown}</p>
                      {nextShowTime && (
                        <p className="mt-2 text-xs text-white/40 tv:text-base">
                          {new Date(nextShowTime).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="font-mono text-2xl font-bold text-red-400 lg:text-3xl tv:text-5xl tracking-widest">STREAMING OFFLINE</p>
                      <p className="mt-2 text-sm text-white/40 tv:text-xl">Tidak ada jadwal streaming saat ini</p>
                    </div>
                  )}
                </div>
              )}
              {isLive && <Watermark tokenCode={tokenCode || "CHANNEL"} />}
            </div>

            {isLive && playlists.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePlaylistSwitch(p)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all tv:px-4 tv:py-2 tv:text-sm ${
                      activePlaylist?.id === p.id
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat - connected to main site chat */}
          <div className="h-[500px] lg:h-auto rounded-xl border border-white/10 overflow-hidden tv:min-h-[600px]">
            <LiveChat
              username={chatUsername}
              tokenId={tokenCode || undefined}
              isLive={isLive}
              isAdmin={false}
            />
          </div>
        </div>
      </div>

      {/* Username Modal */}
      {showUsernameModal && (
        <UsernameModal onSubmit={handleUsernameSet} />
      )}
    </div>
  );
};

export default ChannelPage;
