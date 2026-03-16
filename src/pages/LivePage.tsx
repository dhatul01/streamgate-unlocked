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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [showUsernameModal, setShowUsernameModal] = useState(true);

  const getFingerprint = useCallback(() => {
    let fp = localStorage.getItem("rt48_fp");
    if (!fp) {
      fp = crypto.randomUUID();
      localStorage.setItem("rt48_fp", fp);
    }
    return fp;
  }, []);

  // Validate token
  useEffect(() => {
    if (!tokenCode) {
      setError("Token tidak ditemukan. Silakan gunakan link yang valid.");
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        const { data: token, error: tokenErr } = await supabase
          .from("tokens")
          .select("*")
          .eq("code", tokenCode)
          .single();

        if (tokenErr || !token) {
          setError("Token tidak valid.");
          setLoading(false);
          return;
        }

        if (token.status === "blocked") {
          setError("Token telah diblokir.");
          setLoading(false);
          return;
        }

        if (new Date(token.expires_at) < new Date()) {
          setError("Token telah expired.");
          setLoading(false);
          return;
        }

        // Check device limit
        const fingerprint = getFingerprint();
        const { data: sessions } = await supabase
          .from("token_sessions")
          .select("*")
          .eq("token_id", token.id);

        const existingSession = sessions?.find((s) => s.fingerprint === fingerprint);

        if (!existingSession && (sessions?.length || 0) >= token.max_devices) {
          setError(`Batas perangkat tercapai (${token.max_devices} device).`);
          setLoading(false);
          return;
        }

        // Create or reuse session
        if (!existingSession) {
          const { data: newSession } = await supabase
            .from("token_sessions")
            .insert({
              token_id: token.id,
              fingerprint,
              user_agent: navigator.userAgent,
            })
            .select()
            .single();
          setSessionId(newSession?.id || null);
        } else {
          setSessionId(existingSession.id);
        }

        setTokenData(token);

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

  // Release session on tab close
  useEffect(() => {
    if (!sessionId) return;
    const releaseSession = () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/token_sessions?id=eq.${sessionId}`;
      navigator.sendBeacon(
        url,
        // sendBeacon doesn't support DELETE, so we'll handle cleanup differently
      );
    };

    const handleBeforeUnload = async () => {
      await supabase.from("token_sessions").delete().eq("id", sessionId);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId]);

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
