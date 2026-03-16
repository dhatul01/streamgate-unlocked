import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer, { VideoPlayerHandle } from "@/components/viewer/VideoPlayer";
import LiveChat from "@/components/viewer/LiveChat";
import UsernameModal from "@/components/viewer/UsernameModal";

import logo from "@/assets/logo.png";

const LivePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenCode = searchParams.get("t") || "";
  const [tokenData, setTokenData] = useState<any>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [username, setUsername] = useState(() => localStorage.getItem("rt48_username") || "");
  const [showUsernameModal, setShowUsernameModal] = useState(!localStorage.getItem("rt48_username"));
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [watermarkUrl, setWatermarkUrl] = useState("");
  const [nextShowTime, setNextShowTime] = useState("");
  const [countdown, setCountdown] = useState("");
  const playerRef = useRef<VideoPlayerHandle>(null);

  const getFingerprint = useCallback(() => {
    let fp = localStorage.getItem("rt48_fp");
    if (!fp) {
      fp = crypto.randomUUID();
      localStorage.setItem("rt48_fp", fp);
    }
    return fp;
  }, []);

  // Validate token via secure RPC
  useEffect(() => {
    if (!tokenCode) {
      const fetchSettings = async () => {
        const { data } = await supabase.from("site_settings").select("*");
        if (data) {
          data.forEach((s: any) => {
            if (s.key === "purchase_message") setPurchaseMessage(s.value);
            if (s.key === "whatsapp_number") setWhatsappNumber(s.value);
          });
        }
      };
      fetchSettings();
      setError("no_token");
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        const { data: validation, error: valErr } = await supabase.rpc("validate_token", {
          _code: tokenCode,
        });

        if (valErr) {
          setError("Terjadi kesalahan validasi.");
          setLoading(false);
          return;
        }

        const result = validation as any;
        if (!result.valid) {
          setError(result.error || "Token tidak valid.");
          setLoading(false);
          return;
        }

        const fingerprint = getFingerprint();
        const { data: sessionResult, error: sessErr } = await supabase.rpc("create_token_session", {
          _token_code: tokenCode,
          _fingerprint: fingerprint,
          _user_agent: navigator.userAgent,
        });

        if (sessErr) {
          setError("Gagal membuat session.");
          setLoading(false);
          return;
        }

        const sessData = sessionResult as any;
        if (!sessData.success) {
          setError("device_limit");
          setLoading(false);
          return;
        }

        setTokenData({
          id: result.id,
          code: result.code,
          max_devices: result.max_devices,
          expires_at: result.expires_at,
          status: result.status,
        });

        // Fetch stream, playlists, and settings in parallel
        const [streamRes, playlistRes, settingsRes] = await Promise.all([
          supabase.from("streams").select("*").limit(1).single(),
          supabase.from("playlists").select("*").order("sort_order"),
          supabase.from("site_settings").select("*"),
        ]);

        setStream(streamRes.data);
        setPlaylists(playlistRes.data || []);
        if (playlistRes.data && playlistRes.data.length > 0) {
          setActivePlaylist(playlistRes.data[0]);
        }

        if (settingsRes.data) {
          settingsRes.data.forEach((s: any) => {
            if (s.key === "watermark_image_url" && s.value) setWatermarkUrl(s.value);
            if (s.key === "next_show_time" && s.value) setNextShowTime(s.value);
          });
        }

        setLoading(false);
      } catch {
        setError("Terjadi kesalahan.");
        setLoading(false);
      }
    };

    validateToken();
  }, [tokenCode, getFingerprint]);

  // Release session on tab close
  useEffect(() => {
    if (!tokenCode) return;
    const fingerprint = getFingerprint();

    const handleBeforeUnload = () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/release_token_session`;
      const body = JSON.stringify({ _token_code: tokenCode, _fingerprint: fingerprint });
      navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tokenCode, getFingerprint]);

  // Realtime: streams (live status, title, description)
  useEffect(() => {
    const channel = supabase
      .channel("stream-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "streams" },
        (payload: any) => {
          setStream(payload.new);
          // Auto-play when going live
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
      .channel("playlist-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlists" },
        async () => {
          const { data } = await supabase.from("playlists").select("*").order("sort_order");
          setPlaylists(data || []);
          if (data && data.length > 0 && !activePlaylist) {
            setActivePlaylist(data[0]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activePlaylist]);

  // Realtime: site_settings (watermark + next_show_time)
  useEffect(() => {
    const channel = supabase
      .channel("settings-realtime")
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
        setCountdown("Segera dimulai...");
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

  // Disable right-click on player
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

  const handlePlaylistSwitch = (p: any) => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setActivePlaylist(p);
  };

  const handleUsernameSet = (name: string) => {
    setUsername(name);
    localStorage.setItem("rt48_username", name);
    setShowUsernameModal(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16 animate-float" />
          <p className="text-muted-foreground">Memvalidasi akses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    if (error === "device_limit") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-8 text-center">
            <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-14 w-14" />
            <h2 className="mb-2 text-xl font-bold text-destructive">Batas Perangkat Tercapai</h2>
            <p className="mb-6 text-muted-foreground">
              Token ini telah digunakan pada perangkat lain. Silahkan lakukan pembelian show untuk mendapatkan token baru.
            </p>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              🏠 Ke Halaman Utama
            </button>
          </div>
        </div>
      );
    }

    if (error === "no_token") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
            <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16 animate-float" />
            <h2 className="mb-2 text-xl font-bold text-foreground">Akses Streaming</h2>
            <p className="mb-6 text-muted-foreground">
              {purchaseMessage || "Untuk mengakses streaming, silakan beli token terlebih dahulu."}
            </p>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Halo, saya ingin membeli token streaming")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 font-semibold text-primary-foreground transition hover:bg-success/90"
              >
                💬 Hubungi WhatsApp
              </a>
            )}
            <div className="mt-4">
              <a href="/" className="text-sm text-primary hover:underline">← Kembali ke halaman utama</a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-bold text-destructive">Akses Ditolak</h2>
          <p className="text-muted-foreground">{error}</p>
          <div className="mt-4">
            <a href="/" className="text-sm text-primary hover:underline">← Kembali ke halaman utama</a>
          </div>
        </div>
      </div>
    );
  }

  const isLive = stream?.is_live || false;

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {showUsernameModal && <UsernameModal onSubmit={handleUsernameSet} />}

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <img src={logo} alt="RealTime48" className="h-8 w-8" />
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground lg:text-base">
              {stream?.title || "RealTime48"}
            </h1>
            <p className="text-xs text-muted-foreground">{stream?.description}</p>
          </div>
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-destructive/20 px-3 py-1 text-xs font-semibold text-destructive">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
              LIVE
            </span>
          ) : (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              OFFLINE
            </span>
          )}
        </header>

        <div className="player-area relative">
          {isLive && activePlaylist ? (
            <VideoPlayer ref={playerRef} playlist={activePlaylist} autoPlay watermarkUrl={watermarkUrl} tokenCode={tokenData?.code} />
          ) : (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center bg-card">
              <img src={logo} alt="RealTime48" className="mb-4 h-16 w-16 opacity-30" />
              {countdown ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">Show dimulai dalam</p>
                  <p className="mt-2 font-mono text-4xl font-bold text-primary lg:text-5xl">{countdown}</p>
                  {nextShowTime && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(nextShowTime).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Live stream sedang offline</p>
              )}
            </div>
          )}
        </div>

        {isLive && playlists.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-2">
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePlaylistSwitch(p)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                  activePlaylist?.id === p.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Stream info below player */}
        <div className="border-t border-border px-4 py-3">
          <h2 className="text-sm font-bold text-foreground lg:text-base">{stream?.title || "RealTime48"}</h2>
          {stream?.description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed lg:text-sm">{stream.description}</p>
          )}
        </div>
      </div>

      <div className="h-[50vh] border-t border-border lg:h-auto lg:w-80 lg:border-l lg:border-t-0 xl:w-96">
        <LiveChat
          username={username}
          tokenId={tokenData?.id}
          isLive={isLive}
          isAdmin={false}
        />
      </div>
    </div>
  );
};

export default LivePage;
