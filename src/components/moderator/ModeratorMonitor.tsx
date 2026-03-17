import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer from "@/components/viewer/VideoPlayer";
import LiveChat from "@/components/viewer/LiveChat";

interface Props {
  moderator: any;
}

const ModeratorMonitor = ({ moderator }: Props) => {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [stream, setStream] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: streamData } = await supabase.from("streams").select("*").limit(1).single();
      setStream(streamData);

      const { data: playlistData } = await supabase.rpc("get_playlists_for_channel", { _moderator_username: moderator.username });
      const list = (playlistData || []) as any[];
      setPlaylists(list);
      if (list.length > 0) setActivePlaylist(list[0]);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">📺 Monitor Live</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="rounded-xl border border-border overflow-hidden">
            {activePlaylist ? (
              <VideoPlayer playlist={activePlaylist} />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-card">
                <p className="text-sm text-muted-foreground">Tidak ada sumber video</p>
              </div>
            )}
          </div>
          {playlists.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePlaylist(p)}
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
            isAdmin={true}
            onPinMessage={async (id) => {
              const { data: msg } = await supabase.from("chat_messages").select("is_pinned").eq("id", id).single();
              if (msg) await supabase.from("chat_messages").update({ is_pinned: !msg.is_pinned }).eq("id", id);
            }}
            onDeleteMessage={async (id) => {
              await supabase.from("chat_messages").delete().eq("id", id);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ModeratorMonitor;
