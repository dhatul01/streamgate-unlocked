import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer from "@/components/viewer/VideoPlayer";
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

      // Fetch stream and playlists from main site
      const { data: streamData } = await supabase.from("streams").select("*").limit(1).single();
      setStream(streamData);

      // Fetch playlists securely via channel RPC
      const { data: playlistData } = await supabase.rpc("get_playlists_for_channel", { _moderator_username: username! });
      const list = (playlistData || []) as any[];
      setPlaylists(list);
      if (list.length > 0) setActivePlaylist(list[0]);

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

  const handleUsernameSet = (name: string) => {
    setChatUsername(name);
    localStorage.setItem(`channel_username_${username}`, name);
    setShowUsernameModal(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#1a1a2e" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
            <h1 className="text-lg font-bold text-white tv:text-2xl">
              {moderator?.site_name || "Channel"}
            </h1>
          </div>
          {stream?.is_live && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400 tv:px-4 tv:py-1.5 tv:text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl p-4 tv:p-8">
        <div className="grid gap-4 lg:grid-cols-3 tv:gap-6">
          {/* Player */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-white/10">
              {activePlaylist ? (
                <VideoPlayer playlist={activePlaylist} />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-black/40">
                  <p className="text-sm text-white/50">Tidak ada sumber video</p>
                </div>
              )}
              <Watermark tokenCode={tokenCode || "CHANNEL"} />
            </div>

            {playlists.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePlaylist(p)}
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
              isLive={stream?.is_live || false}
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
