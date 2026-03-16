import { useState, useEffect, useRef, useCallback, useTransition, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Pin, Trash2, ShieldBan, Users } from "lucide-react";

interface LiveChatProps {
  username: string;
  tokenId?: string;
  isLive: boolean;
  isAdmin: boolean;
  onPinMessage?: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
  onBlockUser?: (tokenId: string) => void;
}

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  is_pinned: boolean;
  is_admin: boolean;
  token_id: string | null;
  created_at: string;
}

const LiveChat = ({ username, tokenId, isLive, isAdmin, onPinMessage, onDeleteMessage, onBlockUser }: LiveChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const presenceChannelRef = useRef<any>(null);

  // Presence for online count
  useEffect(() => {
    if (!username) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: username } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user: username, joined_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username]);

  // Load messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) {
        setMessages(data);
        setPinnedMessages(data.filter((m) => m.is_pinned));
      }
    };

    fetchMessages();

    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => [...prev, newMsg]);
            if (newMsg.is_pinned) setPinnedMessages((prev) => [...prev, newMsg]);
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
            setPinnedMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as ChatMessage;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            if (updated.is_pinned) {
              setPinnedMessages((prev) => {
                const exists = prev.find((m) => m.id === updated.id);
                return exists ? prev.map((m) => (m.id === updated.id ? updated : m)) : [...prev, updated];
              });
            } else {
              setPinnedMessages((prev) => prev.filter((m) => m.id !== updated.id));
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !username) return;
    setSending(true);

    const insertData: any = {
      username,
      message: newMessage.trim(),
      token_id: tokenId || null,
    };
    // Only authenticated admins can set is_admin=true (enforced by RLS)
    if (isAdmin) {
      insertData.is_admin = true;
    }
    await supabase.from("chat_messages").insert(insertData);

    setNewMessage("");
    setSending(false);
  };

  const handlePin = async (id: string) => {
    if (onPinMessage) onPinMessage(id);
    else {
      const msg = messages.find((m) => m.id === id);
      if (msg) {
        await supabase.from("chat_messages").update({ is_pinned: !msg.is_pinned }).eq("id", id);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (onDeleteMessage) onDeleteMessage(id);
    else {
      await supabase.from("chat_messages").delete().eq("id", id);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-full flex-col bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="text-sm">💬</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Live Chat</h3>
            {!isLive && (
              <p className="text-[10px] text-warning">Stream offline · chat tetap aktif</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1">
          <Users className="h-3 w-3 text-success" />
          <span className="text-xs font-bold text-success">{onlineCount}</span>
        </div>
      </div>

      {/* Pinned messages */}
      {pinnedMessages.length > 0 && (
        <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 space-y-1">
          {pinnedMessages.map((m) => (
            <div key={m.id} className="flex items-start gap-2 text-xs">
              <Pin className="mt-0.5 h-3 w-3 text-primary shrink-0" />
              <div>
                <span className="font-bold text-primary">{m.username}</span>
                <span className="ml-1 text-foreground/80">{m.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-0.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary/30"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-bold ${
                    msg.is_admin
                      ? "text-primary"
                      : "text-foreground/90"
                  }`}
                >
                  {msg.username}
                </span>
                {msg.is_admin && (
                  <span className="inline-flex items-center rounded bg-primary/15 px-1 py-0.5 text-[9px] font-black tracking-wider text-primary">
                    STAFF
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/60">{formatTime(msg.created_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed break-words">{msg.message}</p>
            </div>

            {isAdmin && (
              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <button
                  onClick={() => handlePin(msg.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  title="Pin"
                >
                  <Pin className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Hapus"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                {msg.token_id && onBlockUser && (
                  <button
                    onClick={() => onBlockUser(msg.token_id!)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Blokir"
                  >
                    <ShieldBan className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-3xl">💬</span>
            <p className="mt-2 text-xs text-muted-foreground">Belum ada pesan. Mulai percakapan!</p>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-border bg-card p-3">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={username ? "Ketik pesan..." : "Masukkan username dulu"}
          disabled={!username || sending}
          className="flex-1 border-secondary bg-secondary/50 text-sm placeholder:text-muted-foreground/50 focus:bg-background"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!username || sending || !newMessage.trim()}
          className="h-10 w-10 shrink-0 rounded-lg"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default LiveChat;
