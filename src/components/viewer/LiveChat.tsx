import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const scrollRef = useRef<HTMLDivElement>(null);

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

    // Subscribe to realtime
    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => [...prev, newMsg]);
            if (newMsg.is_pinned) {
              setPinnedMessages((prev) => [...prev, newMsg]);
            }
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

    return () => {
      supabase.removeChannel(channel);
    };
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

    await supabase.from("chat_messages").insert({
      username,
      message: newMessage.trim(),
      token_id: tokenId || null,
      is_admin: isAdmin,
    });

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">💬 Live Chat</h3>
        {!isLive && (
          <p className="mt-0.5 text-xs text-warning">Live sedang tidak aktif</p>
        )}
      </div>

      {/* Pinned messages */}
      {pinnedMessages.length > 0 && (
        <div className="border-b border-border bg-primary/5 px-4 py-2">
          {pinnedMessages.map((m) => (
            <div key={m.id} className="flex items-start gap-2 text-xs">
              <span className="text-primary">📌</span>
              <span className="font-semibold text-primary">{m.username}:</span>
              <span className="text-foreground">{m.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {messages.map((msg) => (
          <div key={msg.id} className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className={`font-semibold ${msg.is_admin ? "text-primary" : "text-foreground"}`}>
                {msg.username}
                {msg.is_admin && (
                  <span className="ml-1 inline-flex items-center rounded-sm border border-primary/30 bg-primary/10 px-1 py-0.5 text-[10px] font-bold text-primary">
                    STAFF
                  </span>
                )}
              </span>
              <span className="ml-1.5 text-muted-foreground">{msg.message}</span>
            </div>

            {isAdmin && (
              <div className="hidden gap-1 group-hover:flex">
                <button
                  onClick={() => handlePin(msg.id)}
                  className="text-xs text-muted-foreground hover:text-primary"
                  title="Pin"
                >
                  📌
                </button>
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                  title="Hapus"
                >
                  🗑
                </button>
                {msg.token_id && onBlockUser && (
                  <button
                    onClick={() => onBlockUser(msg.token_id!)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                    title="Blokir"
                  >
                    🚫
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 border-t border-border p-3">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={username ? "Ketik pesan..." : "Masukkan username dulu"}
          disabled={!username || sending}
          className="flex-1 bg-background text-sm"
        />
        <Button type="submit" size="sm" disabled={!username || sending || !newMessage.trim()}>
          Kirim
        </Button>
      </form>
    </div>
  );
};

export default LiveChat;
