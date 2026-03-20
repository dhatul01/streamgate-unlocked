import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense, memo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer, { VideoPlayerHandle } from "@/components/viewer/VideoPlayer";
import { useSignedStreamUrl } from "@/hooks/useSignedStreamUrl";

// Lazy load heavy components
const LiveChat = lazy(() => import("@/components/viewer/LiveChat"));
const UsernameModal = lazy(() => import("@/components/viewer/UsernameModal"));
const PlayerAnimations = lazy(() => import("@/components/viewer/PlayerAnimations"));
const ConnectionStatus = lazy(() => import("@/components/viewer/ConnectionStatus"));
const GiftOverlay = lazy(() => import("@/components/viewer/GiftOverlay"));
const GiftButton = lazy(() => import("@/components/viewer/GiftButton"));
const LivePoll = lazy(() => import("@/components/viewer/LivePoll"));
const PipButton = lazy(() => import("@/components/viewer/PipButton"));

type AnimationType = "none" | "snow" | "stars" | "rain" | "leaves" | "bubbles" | "fireflies" | "confetti" | "money" | "trees" | "hearts" | "sakura" | "sparkle" | "balloons";

import logo from "@/assets/logo.png";

const LivePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenCode = searchParams.get("t") || "";
  const [tokenData, setTokenData] = useState<any>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [username, setUsername] = useState(() => localStorage.getItem("rt48_username") || "");
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [watermarkUrl, setWatermarkUrl] = useState("");
  const [nextShowTime, setNextShowTime] = useState("");
  const [countdown, setCountdown] = useState("");
  const [playerAnimation, setPlayerAnimation] = useState<AnimationType>("none");
  const playerRef = useRef<VideoPlayerHandle>(null);

  // Auto-detect authenticated user and set their profile username + coin balance
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setLoggedInUser(user);
        const [{ data: profile }, { data: balanceData }] = await Promise.all([
          supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
          supabase.from("coin_balances").select("balance").eq("user_id", user.id).maybeSingle(),
        ]);
        if (profile?.username) {
          setUsername(profile.username);
          localStorage.setItem("rt48_username", profile.username);
          setShowUsernameModal(false);
        }
        setCoinBalance(balanceData?.balance || 0);
        setAuthChecked(true);

        // Subscribe to coin balance changes
        const balanceChannel = supabase
          .channel('live-coin-balance')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_balances', filter: `user_id=eq.${user.id}` },
            (payload: any) => { if (payload.new?.balance !== undefined) setCoinBalance(payload.new.balance); }
          ).subscribe();

        return () => { supabase.removeChannel(balanceChannel); };
      }
      // Not authenticated or no username - show modal if no stored username
      if (!localStorage.getItem("rt48_username")) {
        setShowUsernameModal(true);
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  const getFingerprint = useCallback(() => {
    let fp = localStorage.getItem("rt48_fp");
    if (!fp) {
      fp = crypto.randomUUID();
      localStorage.setItem("rt48_fp", fp);
    }
    return fp;
  }, []);

  const syncStreamState = useCallback((nextStream: any) => {
    setStream((prev: any) => {
      if (prev?.updated_at === nextStream?.updated_at && prev?.is_live === nextStream?.is_live) {
        return prev;
      }
      return nextStream;
    });
  }, []);

  // Sort playlists: m3u8/cloudflare always above youtube
  const sortPlaylists = useCallback((list: any[]) => {
    if (!list) return [];
    const priority: Record<string, number> = { m3u8: 0, cloudflare: 1, youtube: 2 };
    return [...list].sort((a, b) => {
      const pa = priority[a.type] ?? 1;
      const pb = priority[b.type] ?? 1;
      if (pa !== pb) return pa - pb;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, []);

  const syncPlaylistsState = useCallback((nextPlaylists: any[]) => {
    const sorted = sortPlaylists(nextPlaylists || []);
    setPlaylists(sorted);
    setActivePlaylist((prev: any) => {
      if (!sorted.length) return null;
      if (!prev) return sorted[0];
      const matched = sorted.find((playlist) => playlist.id === prev.id);
      return matched || sorted[0];
    });
  }, [sortPlaylists]);

  // Generate signed/tokenized URL for m3u8 playlists
  const { signedUrl: signedStreamUrl, loading: signedUrlLoading } = useSignedStreamUrl(
    activePlaylist,
    tokenCode
  );

  const playerKey = useMemo(() => {
    if (!stream?.is_live || !activePlaylist) return "offline";
    // Stable key: only change when stream or playlist identity changes, NOT on signed URL refresh
    return `${stream.id}-${activePlaylist.id}-${activePlaylist.type}`;
  }, [stream?.id, stream?.is_live, activePlaylist?.id, activePlaylist?.type]);

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

        const [streamRes, playlistRes, settingsRes] = await Promise.all([
          supabase.from("streams").select("*").limit(1).single(),
          supabase.rpc("get_playlists_for_token", { _token_code: tokenCode }),
          supabase.from("site_settings").select("*"),
        ]);

        if (streamRes.data) {
          syncStreamState(streamRes.data);
        }
        syncPlaylistsState(playlistRes.data || []);

        if (settingsRes.data) {
          settingsRes.data.forEach((s: any) => {
            if (s.key === "watermark_image_url" && s.value) setWatermarkUrl(s.value);
            if (s.key === "next_show_time" && s.value) setNextShowTime(s.value);
            if (s.key === "player_animation" && s.value) setPlayerAnimation(s.value as AnimationType);
            if (s.key === "whatsapp_number" && s.value) setWhatsappNumber(s.value);
            if (s.key === "purchase_message" && s.value) setPurchaseMessage(s.value);
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
      // sendBeacon doesn't support custom headers, so we use fetch keepalive instead
      // This ensures the apikey header is sent and Supabase accepts the request
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tokenCode, getFingerprint]);

  // Realtime + polling fallback: streams
  useEffect(() => {
    let isMounted = true;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollDelay = 2000;

    const fetchLatestStream = async () => {
      const { data } = await supabase.from("streams").select("*").limit(1).single();
      if (isMounted && data) {
        syncStreamState(data);
      }
    };

    const schedulePoll = () => {
      if (!isMounted) return;
      pollTimeout = setTimeout(async () => {
        await fetchLatestStream();
        pollDelay = Math.min(pollDelay * 1.5, 10000);
        schedulePoll();
      }, pollDelay);
    };

    const channel = supabase
      .channel("stream-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "streams" },
        (payload: any) => {
          if (!payload.new) return;
          syncStreamState(payload.new);
          pollDelay = 2000;
        }
      )
      .subscribe();

    fetchLatestStream();
    schedulePoll();

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
      supabase.removeChannel(channel);
    };
  }, [syncStreamState]);

  // Realtime: playlists
  useEffect(() => {
    if (!tokenCode) return;

    const fetchLatestPlaylists = async () => {
      const { data } = await supabase.rpc("get_playlists_for_token", { _token_code: tokenCode });
      syncPlaylistsState(data || []);
    };

    const channel = supabase
      .channel("playlist-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlists" },
        async () => {
          await fetchLatestPlaylists();
        }
      )
      .subscribe();

    fetchLatestPlaylists();
    return () => { supabase.removeChannel(channel); };
  }, [tokenCode, syncPlaylistsState]);

  // Realtime: site_settings
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
          if (row?.key === "player_animation") setPlayerAnimation((row.value || "none") as AnimationType);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

   // Realtime: token block & delete detection + polling fallback
  // Use longer interval (60s) since realtime handles instant updates
  // This prevents overwhelming the DB with 1000+ concurrent users
  useEffect(() => {
    if (!tokenData?.id) return;
    let isMounted = true;

    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      const { data, error: err } = await supabase.rpc("validate_token", { _code: tokenCode });
      if (err) return;
      const result = data as any;
      if (!result.valid) {
        if (result.error === "Token telah diblokir") {
          setBlocked(true);
        } else {
          setDeleted(true);
        }
      } else {
        setBlocked(false);
      }
    }, 60000); // 60s instead of 10s — realtime handles instant updates

    const channel = supabase
      .channel("token-block-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tokens", filter: `id=eq.${tokenData.id}` },
        (payload: any) => {
          if (payload.new.status === "blocked") {
            setBlocked(true);
          } else if (payload.new.status === "active") {
            setBlocked(false);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tokens", filter: `id=eq.${tokenData.id}` },
        () => {
          setDeleted(true);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [tokenData?.id, tokenCode]);

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

  // Keep player synced when live status or playlist changes
  useEffect(() => {
    if (!stream?.is_live || !activePlaylist) return;
    const timer = setTimeout(() => {
      playerRef.current?.play();
    }, 700);
    return () => clearTimeout(timer);
  }, [stream?.is_live, activePlaylist, playerKey]);

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

  const handlePlaylistSwitch = (playlist: any) => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setActivePlaylist(playlist);
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
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16 tv:h-24 tv:w-24 animate-float rounded-full border-2 border-primary/50 shadow-[0_0_16px_hsl(var(--primary)/0.4)]" />
          <p className="text-muted-foreground tv:text-xl">Memvalidasi akses...</p>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md tv:max-w-xl animate-in fade-in zoom-in-95 duration-500 rounded-2xl border-2 border-destructive bg-card p-8 tv:p-12 text-center shadow-2xl">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16 tv:h-24 tv:w-24 rounded-full border-2 border-primary/50 shadow-[0_0_16px_hsl(var(--primary)/0.4)]" />
          <div className="mx-auto mb-4 flex h-20 w-20 tv:h-28 tv:w-28 items-center justify-center rounded-full bg-destructive/10 animate-pulse">
            <span className="text-4xl tv:text-6xl">🚫</span>
          </div>
          <h2 className="mb-1 text-2xl font-black text-destructive uppercase tracking-widest tv:text-4xl">
            AUTO BLOCK
          </h2>
          <p className="mb-3 text-sm font-bold text-destructive/80 uppercase tracking-wide tv:text-lg">
            Terdeteksi Restream
          </p>
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 mb-4 tv:p-6">
            <p className="text-sm font-semibold text-foreground leading-relaxed tv:text-base">
              DILARANG RESTREAM YA, KAN DIBLOKIR TUHHH!!!
            </p>
            <p className="mt-2 text-xs text-muted-foreground tv:text-sm">
              Token Anda telah diblokir secara otomatis karena terdeteksi melakukan pelanggaran restream. Konfirmasi pada admin RealTime48 untuk informasi lebih lanjut.
            </p>
          </div>
          <p className="mb-6 text-[10px] text-muted-foreground font-mono tv:text-xs">
            Token: {tokenData?.code || "N/A"}
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 tv:px-10 tv:py-4 font-semibold text-primary-foreground transition hover:bg-primary/90 tv:text-lg"
          >
            🏠 Ke Halaman Utama
          </button>
        </div>
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md tv:max-w-xl animate-in fade-in zoom-in-95 duration-500 rounded-2xl border-2 border-destructive/50 bg-card p-8 tv:p-12 text-center shadow-2xl">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16 tv:h-24 tv:w-24 rounded-full border-2 border-primary/50 shadow-[0_0_16px_hsl(var(--primary)/0.4)]" />
          <div className="mx-auto mb-4 flex h-20 w-20 tv:h-28 tv:w-28 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-4xl tv:text-6xl">❌</span>
          </div>
          <h2 className="mb-2 text-2xl font-black text-destructive uppercase tracking-widest tv:text-4xl">
            TOKEN INVALID
          </h2>
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 mb-4 tv:p-6">
            <p className="text-sm font-semibold text-foreground leading-relaxed tv:text-base">
              Token ini tidak lagi berlaku.
            </p>
            <p className="mt-2 text-xs text-muted-foreground tv:text-sm">
              Silakan hubungi admin RealTime48 untuk membeli token baru.
            </p>
          </div>
          {whatsappNumber ? (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Halo admin, saya ingin membeli token baru")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 tv:px-10 tv:py-4 font-semibold text-primary-foreground transition hover:bg-success/90 tv:text-lg"
            >
              💬 Hubungi Admin
            </a>
          ) : (
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 tv:px-10 tv:py-4 font-semibold text-primary-foreground transition hover:bg-primary/90 tv:text-lg"
            >
              🏠 Ke Halaman Utama
            </button>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    if (error === "device_limit") {
      const handleSelfReset = async () => {
        const fingerprint = getFingerprint();
        try {
          const { data, error: rpcErr } = await supabase.rpc("self_reset_token_session" as any, {
            _token_code: tokenCode,
            _fingerprint: fingerprint,
          });
          if (rpcErr) throw rpcErr;
          const result = data as any;
          if (result.success) {
            window.location.reload();
          } else {
            setError(result.error || "Gagal reset session");
          }
        } catch {
          setError("Gagal reset session. Coba lagi nanti.");
        }
      };

      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md tv:max-w-xl rounded-2xl border border-destructive/30 bg-card p-8 tv:p-12 text-center">
            <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-14 w-14 tv:h-20 tv:w-20 rounded-full border border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.3)]" />
            <h2 className="mb-2 text-xl font-bold text-destructive tv:text-3xl">Batas Perangkat Tercapai</h2>
            <p className="mb-4 text-muted-foreground tv:text-lg">
              Token ini sedang digunakan di perangkat lain.
            </p>
            <div className="mb-6 rounded-xl border border-border bg-secondary/30 p-4 tv:p-6 text-left space-y-2">
              <p className="text-xs font-semibold text-foreground tv:text-sm">🔄 Reset Session Mandiri</p>
              <p className="text-xs text-muted-foreground tv:text-sm">
                Jika Anda keluar dari website tanpa menutup tab dengan benar, session mungkin masih terhitung. Gunakan tombol di bawah untuk mereset session (maks 2x/hari).
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSelfReset}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 tv:px-10 tv:py-4 font-semibold text-primary-foreground transition hover:bg-primary/90 tv:text-lg"
              >
                🔄 Reset Token Saya
              </button>
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 tv:px-10 tv:py-4 font-semibold text-secondary-foreground transition hover:bg-secondary/80 tv:text-lg"
              >
                🏠 Ke Halaman Utama
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (error === "no_token") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md tv:max-w-xl rounded-2xl border border-border bg-card p-8 tv:p-12 text-center">
            <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16 tv:h-24 tv:w-24 animate-float rounded-full border-2 border-primary/50 shadow-[0_0_16px_hsl(var(--primary)/0.4)]" />
            <h2 className="mb-2 text-xl font-bold text-foreground tv:text-3xl">Akses Streaming</h2>
            <p className="mb-6 text-muted-foreground tv:text-lg">
              {purchaseMessage || "Untuk mengakses streaming, silakan beli token terlebih dahulu."}
            </p>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Halo, saya ingin membeli token streaming")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 tv:px-10 tv:py-4 font-semibold text-primary-foreground transition hover:bg-success/90 tv:text-lg"
              >
                💬 Hubungi WhatsApp
              </a>
            )}
            <div className="mt-4">
              <a href="/" className="text-sm text-primary hover:underline tv:text-base">← Kembali ke halaman utama</a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-xl border border-destructive/30 bg-card p-8 tv:p-12 text-center">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-12 w-12 tv:h-20 tv:w-20 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" />
          <h2 className="mb-2 text-xl font-bold text-destructive tv:text-3xl">Akses Ditolak</h2>
          <p className="text-muted-foreground tv:text-lg">{error}</p>
          <div className="mt-4">
            <a href="/" className="text-sm text-primary hover:underline tv:text-base">← Kembali ke halaman utama</a>
          </div>
        </div>
      </div>
    );
  }

  const isLive = stream?.is_live || false;

  const isAuthenticated = !!tokenData;

  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:flex-row">
      <Suspense fallback={null}>
        <ConnectionStatus />
      </Suspense>
      <Suspense fallback={null}>
        <PlayerAnimations type={playerAnimation} backgroundOnly={isLive} />
      </Suspense>
      {showUsernameModal && (
        <Suspense fallback={null}>
          <UsernameModal onSubmit={handleUsernameSet} />
        </Suspense>
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 tv:px-8 tv:py-5">
          <img src={logo} alt="RealTime48" className="h-8 w-8 tv:h-14 tv:w-14 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" />
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground lg:text-base tv:text-2xl">
              {stream?.title || "RealTime48"}
            </h1>
            <p className="text-xs text-muted-foreground tv:text-base">{stream?.description}</p>
          </div>
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-destructive/20 px-3 py-1 tv:px-5 tv:py-2 text-xs font-semibold text-destructive tv:text-base">
              <span className="h-2 w-2 tv:h-3 tv:w-3 animate-pulse rounded-full bg-destructive" />
              LIVE
            </span>
          ) : (
            <span className="rounded-full bg-muted px-3 py-1 tv:px-5 tv:py-2 text-xs font-medium text-muted-foreground tv:text-base">
              OFFLINE
            </span>
          )}
        </header>

        <div className="player-area relative">
          {isLive && activePlaylist && signedStreamUrl ? (
            <>
              <VideoPlayer
                key={playerKey}
                ref={playerRef}
                playlist={{
                  ...activePlaylist,
                  url: activePlaylist.type === "m3u8" ? signedStreamUrl : activePlaylist.url,
                }}
                autoPlay
                watermarkUrl={watermarkUrl}
                tokenCode={tokenData?.code}
              />
              <Suspense fallback={null}>
                <GiftOverlay />
              </Suspense>
            </>
          ) : isLive && activePlaylist && signedUrlLoading ? (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center bg-card">
              <div className="flex flex-col items-center gap-3 tv:gap-5">
                <div className="h-10 w-10 tv:h-16 tv:w-16 animate-spin rounded-full border-4 tv:border-[6px] border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground animate-pulse tv:text-lg">Mengamankan koneksi streaming...</p>
              </div>
            </div>
          ) : isLive && !activePlaylist ? (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center bg-card">
              <img src={logo} alt="RealTime48" className="mb-4 h-16 w-16 tv:h-28 tv:w-28 opacity-30" />
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-primary lg:text-3xl tv:text-5xl tracking-widest">MENYIAPKAN STREAM</p>
                <p className="mt-2 text-sm text-muted-foreground tv:text-xl">Playlist live sedang disinkronkan...</p>
              </div>
            </div>
          ) : (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center bg-card">
              <img src={logo} alt="RealTime48" className="mb-4 h-16 w-16 tv:h-28 tv:w-28 opacity-30" />
              {countdown ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground tv:text-xl">Show dimulai dalam</p>
                  <p className="mt-2 font-mono text-4xl font-bold text-primary lg:text-5xl tv:text-7xl">{countdown}</p>
                  {nextShowTime && (
                    <p className="mt-2 text-xs text-muted-foreground tv:text-base">
                      {new Date(nextShowTime).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-mono text-2xl font-bold text-destructive lg:text-3xl tv:text-5xl tracking-widest">STREAMING OFFLINE</p>
                  <p className="mt-2 text-sm text-muted-foreground tv:text-xl">Tidak ada jadwal streaming saat ini</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gift & PiP buttons below player when live */}
        {isLive && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-2 tv:px-8 tv:py-3">
            <Suspense fallback={null}>
              <GiftButton isAuthenticated={!!tokenData} />
            </Suspense>
            <Suspense fallback={null}>
              <PipButton />
            </Suspense>
            <div className="flex-1" />
          </div>
        )}

        {isLive && playlists.length > 1 && (
          <div className="flex gap-2 tv:gap-3 overflow-x-auto border-t border-border px-4 py-2 tv:px-8 tv:py-4">
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePlaylistSwitch(p)}
                className={`whitespace-nowrap rounded-lg tv:rounded-xl px-4 py-2 tv:px-6 tv:py-3 text-xs font-medium transition-all tv:text-base ${
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
        <div className="border-t border-border px-4 py-3 tv:px-8 tv:py-5">
          <h2 className="text-sm font-bold text-foreground lg:text-base tv:text-2xl">{stream?.title || "RealTime48"}</h2>
          {stream?.description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed lg:text-sm tv:text-base">{stream.description}</p>
          )}
        </div>
      </div>

      <div className="h-[50vh] border-t border-border lg:h-screen lg:sticky lg:top-0 lg:w-80 lg:border-l lg:border-t-0 xl:w-96 tv:w-[480px]">
        {/* Live Poll above chat */}
        {isLive && (
          <Suspense fallback={null}>
            <LivePoll voterId={tokenData?.id || username} />
          </Suspense>
        )}
        <Suspense fallback={
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">Memuat chat...</p>
          </div>
        }>
          <LiveChat
            username={username}
            tokenId={tokenData?.id}
            isLive={isLive}
            isAdmin={false}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default LivePage;
