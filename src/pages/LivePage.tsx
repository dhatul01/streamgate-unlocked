import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer from "@/components/viewer/VideoPlayer";
import LiveChat from "@/components/viewer/LiveChat";
import UsernameModal from "@/components/viewer/UsernameModal";
import Watermark from "@/components/viewer/Watermark";
import logo from "@/assets/logo.png";

const LivePage = () => {
  const [searchParams] = useSearchParams();
  const tokenCode = searchParams.get("t") || "";
  const [tokenData, setTokenData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

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
      // Fetch site settings for purchase info
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
        // Step 1: Validate token via SECURITY DEFINER function
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

        // Step 2: Create/reuse session via SECURITY DEFINER function
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
          setError(sessData.error || "Gagal membuat session.");
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

        // Fetch stream data
        const { data: streamData } = await supabase
          .from("streams")
          .select("*")
          .limit(1)
          .single();
        setStream(streamData);

        // Fetch playlists
        const { data: playlistData } = await supabase
          .from("playlists")
          .select("*")
          .order("sort_order");
        setPlaylists(playlistData || []);
        if (playlistData && playlistData.length > 0) {
          setActivePlaylist(playlistData[0]);
        }

        setLoading(false);
      } catch {
        setError("Terjadi kesalahan.");
        setLoading(false);
      }
    };

    validateToken();
  }, [tokenCode, getFingerprint]);

  // Release session on tab close via secure RPC
  useEffect(() => {
    if (!tokenCode) return;
    const fingerprint = getFingerprint();

    const handleBeforeUnload = () => {
      // Use sendBeacon with fetch as fallback - call RPC to release session
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/release_token_session`;
      const body = JSON.stringify({ _token_code: tokenCode, _fingerprint: fingerprint });
      const sent = navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" })
      );
      if (!sent) {
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body,
          keepalive: true,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tokenCode, getFingerprint]);

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

  const handleUsernameSet = (name: string) => {
    setUsername(name);
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-bold text-destructive">Akses Ditolak</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {showUsernameModal && <UsernameModal onSubmit={handleUsernameSet} />}

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <img src={logo} alt="RealTime48" className="h-8 w-8" />
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground lg:text-base">
              {stream?.title || "RealTime48"}
            </h1>
            <p className="text-xs text-muted-foreground">{stream?.description}</p>
          </div>
          {stream?.is_live ? (
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

        {/* Player area */}
        <div className="player-area relative flex-1">
          {activePlaylist ? (
            <VideoPlayer playlist={activePlaylist} />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-card">
              <p className="text-muted-foreground">Tidak ada sumber video tersedia.</p>
            </div>
          )}
          {tokenData && <Watermark tokenCode={tokenData.code} />}
        </div>

        {/* Playlist switcher */}
        {playlists.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-2">
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePlaylist(p)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                  activePlaylist?.id === p.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat sidebar */}
      <div className="h-[50vh] border-t border-border lg:h-auto lg:w-80 lg:border-l lg:border-t-0 xl:w-96">
        <LiveChat
          username={username}
          tokenId={tokenData?.id}
          isLive={stream?.is_live || false}
          isAdmin={false}
        />
      </div>
    </div>
  );
};

export default LivePage;
