import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer, { VideoPlayerHandle } from "@/components/viewer/VideoPlayer";
import LiveChat from "@/components/viewer/LiveChat";
import { useToast } from "@/hooks/use-toast";

interface Props {
  moderator: any;
}

const ModeratorMonitor = ({ moderator }: Props) => {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [stream, setStream] = useState<any>(null);
  const { toast } = useToast();
  const playerRef = useRef<VideoPlayerHandle>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: streamData } = await supabase.from("streams").select("*").limit(1).single();
      setStream(streamData);

      // Fetch moderator's own playlists
      const { data: modPlaylists } = await supabase
        .from("moderator_playlists")
        .select("*")
        .eq("moderator_id", moderator.id)
        .order("sort_order");

      const list = (modPlaylists || []) as any[];

      // If moderator has own playlists, use them; otherwise fall back to main playlists
      if (list.length > 0) {
        setPlaylists(list);
        setActivePlaylist(list[0]);
      } else {
        const { data: mainPlaylists } = await supabase.rpc("get_playlists_for_channel", { _moderator_username: moderator.username });
        const mainList = (mainPlaylists || []) as any[];
        setPlaylists(mainList);
        if (mainList.length > 0) setActivePlaylist(mainList[0]);
      }
    };
    fetchData();
  }, [moderator.id, moderator.username]);

  const handlePlaylistSwitch = (p: any) => {
    playerRef.current?.pause();
    setActivePlaylist(p);
  };

  const handleBlockUser = async (tokenId: string) => {
    const { data: existing } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("token_id", tokenId)
      .limit(1);

    if (existing && existing.length > 0) {
      toast({ title: "User sudah diblokir", variant: "destructive" });
      return;
    }

    await supabase.from("blocked_users").insert({ token_id: tokenId, reason: `Blocked by MOD:${moderator.username}` });
    toast({ title: "User berhasil diblokir" });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">📺 Monitor Live</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="rounded-xl border border-border overflow-hidden">
            {activePlaylist ? (
              <VideoPlayer ref={playerRef} playlist={activePlaylist} />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-card">
                <p className="text-sm text-muted-foreground">Tidak ada sumber video. Tambahkan playlist di menu Playlist.</p>
              </div>
            )}
          </div>
          {playlists.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePlaylistSwitch(p)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
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
        </div>

        <div className="h-[500px] rounded-xl border border-border overflow-hidden">
          <LiveChat
            username={`MOD:${moderator.username}`}
            isLive={stream?.is_live || false}
            isAdmin={false}
            canModerate={true}
            onPinMessage={async (id) => {
              const { data: msg } = await supabase.from("chat_messages").select("is_pinned").eq("id", id).single();
              if (msg) await supabase.from("chat_messages").update({ is_pinned: !msg.is_pinned }).eq("id", id);
            }}
            onDeleteMessage={async (id) => {
              await supabase.from("chat_messages").delete().eq("id", id);
            }}
            onBlockUser={handleBlockUser}
          />
        </div>
      </div>
    </div>
  );
};

export default ModeratorMonitor;
