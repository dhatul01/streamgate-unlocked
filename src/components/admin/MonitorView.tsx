import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer from "@/components/viewer/VideoPlayer";
import LiveChat from "@/components/viewer/LiveChat";
import ChatModeratorManager from "@/components/admin/ChatModeratorManager";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MonitorView = () => {
  const [stream, setStream] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data: streamData } = await supabase.from("streams").select("*").limit(1).single();
      setStream(streamData);

      const { data: playlistData } = await supabase.from("playlists").select("*").order("sort_order");
      setPlaylists(playlistData || []);
      if (playlistData && playlistData.length > 0) setActivePlaylist(playlistData[0]);
    };
    fetch();
  }, []);

  const handleResetChat = async () => {
    setResetting(true);
    const { error } = await supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setResetting(false);
    if (error) {
      toast({ title: "Gagal mereset chat", variant: "destructive" });
    } else {
      toast({ title: "Live chat berhasil direset" });
    }
  };

  const handleBlockUser = async (tokenId: string) => {
    await supabase.from("tokens").update({ status: "blocked" }).eq("id", tokenId);
    await supabase.from("blocked_users").insert({ token_id: tokenId, reason: "Blocked from chat" });
    toast({ title: "User diblokir" });
  };

  const handlePinMessage = async (id: string) => {
    const { data: msg } = await supabase.from("chat_messages").select("is_pinned").eq("id", id).single();
    if (msg) {
      await supabase.from("chat_messages").update({ is_pinned: !msg.is_pinned }).eq("id", id);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    await supabase.from("chat_messages").delete().eq("id", id);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">📺 Monitor</h2>

      {/* Reset Chat Button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={resetting} className="gap-2">
            <Trash2 className="h-4 w-4" />
            {resetting ? "Mereset..." : "Reset Live Chat"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Live Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua pesan chat (termasuk yang di-pin) akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetChat}>Ya, Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Player */}
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
                      : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="h-[500px] rounded-xl border border-border overflow-hidden">
          <LiveChat
            username="Admin"
            isLive={stream?.is_live || false}
            isAdmin={true}
            onPinMessage={handlePinMessage}
            onDeleteMessage={handleDeleteMessage}
            onBlockUser={handleBlockUser}
          />
        </div>
      </div>

      {/* Chat Moderator Management */}
      <ChatModeratorManager />
    </div>
  );
};

export default MonitorView;
