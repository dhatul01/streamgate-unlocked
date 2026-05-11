import { useState, useEffect, useRef, useCallback, useTransition, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Pin, Trash2, ShieldBan, ShieldPlus, ShieldMinus, Users, Trophy, LogIn } from "lucide-react";
import ChatLeaderboard from "@/components/viewer/ChatLeaderboard";
import { toast } from "sonner";

interface LiveChatProps {
  username: string;
  tokenId?: string;
  isLive: boolean;
  isAdmin: boolean;
  onPinMessage?: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
  onBlockUser?: (tokenId: string) => void;
  onToggleChatMod?: (username: string, isMod: boolean) => void;
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

// Badge components
const AdminBadge = () => (
  <span className="inline-flex items-center gap-0.5 rounded-md bg-gradient-to-r from-yellow-500/20 via-amber-400/20 to-yellow-600/20 border border-yellow-500/40 px-1.5 py-0.5 text-[9px] tv:text-[11px] font-black tracking-wider text-yellow-400 shadow-[0_0_6px_hsl(45,100%,50%,0.2)]">
    <span className="text-[8px] tv:text-[10px]">🚩</span>
    ADMIN
  </span>
);

const ModeratorBadge = () => (
  <span className="inline-flex items-center gap-0.5 rounded-md bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-purple-500/15 border border-cyan-400/30 px-1.5 py-0.5 text-[9px] tv:text-[11px] font-bold tracking-wider text-cyan-400">
    <span className="text-[8px] tv:text-[10px]">🛡️</span>
    MOD
  </span>
);

const ChatMessageItem = memo(({ msg, isAdmin, isChatMod, chatModUsernames, onPin, onDelete, onBlock, onToggleMod, formatTime }: {
  msg: ChatMessage;
  isAdmin: boolean;
  isChatMod: boolean;
  chatModUsernames: Set<string>;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onBlock?: (tokenId: string) => void;
  onToggleMod?: (username: string, isMod: boolean) => void;
  formatTime: (d: string) => string;
}) => {
  const canModerate = isAdmin || isChatMod;
  const isMsgFromMod = chatModUsernames.has(msg.username);

  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-1.5 tv:px-3 tv:py-2.5 text-sm transition-colors hover:bg-secondary/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-bold tv:text-sm ${msg.is_admin ? "text-yellow-400" : isMsgFromMod ? "text-cyan-400" : "text-foreground/90"}`}>
            {msg.username}
          </span>
          {msg.is_admin && <AdminBadge />}
          {!msg.is_admin && isMsgFromMod && <ModeratorBadge />}
          <span className="text-[10px] tv:text-xs text-muted-foreground/60">{formatTime(msg.created_at)}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed break-words tv:text-sm">{msg.message}</p>
      </div>
      {canModerate && (
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {isAdmin && (
            <button onClick={() => onPin(msg.id)} className="rounded p-1 tv:p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" title="Pin">
              <Pin className="h-3 w-3 tv:h-4 tv:w-4" />
            </button>
          )}
          <button onClick={() => onDelete(msg.id)} className="rounded p-1 tv:p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Hapus">
            <Trash2 className="h-3 w-3 tv:h-4 tv:w-4" />
          </button>
          {msg.token_id && onBlock && (
            <button onClick={() => onBlock(msg.token_id!)} className="rounded p-1 tv:p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Blokir">
              <ShieldBan className="h-3 w-3 tv:h-4 tv:w-4" />
            </button>
          )}
          {/* Admin can toggle mod status directly from chat */}
          {isAdmin && !msg.is_admin && onToggleMod && (
            <button
              onClick={() => onToggleMod(msg.username, isMsgFromMod)}
              className={`rounded p-1 tv:p-1.5 text-muted-foreground ${isMsgFromMod ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-cyan-500/10 hover:text-cyan-400"}`}
              title={isMsgFromMod ? "Hapus Moderator" : "Jadikan Moderator"}
            >
              {isMsgFromMod ? <ShieldMinus className="h-3 w-3 tv:h-4 tv:w-4" /> : <ShieldPlus className="h-3 w-3 tv:h-4 tv:w-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
ChatMessageItem.displayName = "ChatMessageItem";

const LiveChat = ({ username, tokenId, isLive, isAdmin, onPinMessage, onDeleteMessage, onBlockUser, onToggleChatMod }: LiveChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatModUsernames, setChatModUsernames] = useState<Set<string>>(new Set());
  const [hasSession, setHasSession] = useState(false);
  const [guestUsername, setGuestUsername] = useState<string>(() => {
    try { return localStorage.getItem("guest_chat_username") || ""; } catch { return ""; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const presenceChannelRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Effective username: prefer logged-in/token name, fall back to guest input
  const effectiveUsername = (username && username.trim()) || guestUsername.trim();
  const isGuest = !hasSession && !isAdmin;
  const isChatMod = chatModUsernames.has(effectiveUsername);

  // Track Supabase session — required for inserting chat messages (RLS)
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setHasSession(!!session);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Load chat moderators
  useEffect(() => {
    const fetchMods = async () => {
      const { data } = await supabase.from("chat_moderators").select("username");
      if (data) {
        setChatModUsernames(new Set(data.map((m: any) => m.username)));
      }
    };
    fetchMods();

    const channel = supabase
      .channel("chat-mods-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_moderators" }, () => {
        fetchMods();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Presence for online count
  useEffect(() => {
    if (!username) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: username } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        startTransition(() => setOnlineCount(Object.keys(state).length));
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
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) data.reverse();
      if (data) {
        startTransition(() => {
          setMessages(data);
          setPinnedMessages(data.filter((m) => m.is_pinned));
        });
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-realtime-${tokenId ?? "anon"}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        (payload) => {
          startTransition(() => {
            if (payload.eventType === "INSERT") {
              const newMsg = payload.new as ChatMessage;
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                const next = [...prev, newMsg];
                return next.length > 30 ? next.slice(-30) : next;
              });
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
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tokenId]);

  // Auto-scroll only when user is near bottom (prevents jump when reading older msgs / when trim happens)
  const isNearBottomRef = useRef(true);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Chat throttle: limit to 1 message per 2 seconds
  const lastSentRef = useRef(0);

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !username) return;

    if (!hasSession && !isAdmin) {
      toast.error("Login dulu untuk mengirim pesan", {
        description: "Pesan chat hanya bisa dikirim setelah login akun.",
        action: { label: "Login", onClick: () => { window.location.href = "/auth?redirect=" + encodeURIComponent(window.location.pathname + window.location.search); } },
      });
      return;
    }

    const now = Date.now();
    if (now - lastSentRef.current < 2000) {
      toast.info("Tunggu sebentar sebelum kirim pesan lagi");
      return;
    }
    lastSentRef.current = now;

    setSending(true);

    const insertData: any = {
      username,
      message: newMessage.trim(),
      token_id: tokenId || null,
    };
    if (isAdmin) {
      insertData.is_admin = true;
    }
    const { error } = await supabase.from("chat_messages").insert(insertData);

    if (error) {
      toast.error("Gagal mengirim pesan", { description: error.message });
      lastSentRef.current = 0; // allow retry immediately
    } else {
      setNewMessage("");
    }
    setSending(false);
    inputRef.current?.focus();
  }, [newMessage, username, tokenId, isAdmin, hasSession]);

  const handlePin = useCallback(async (id: string) => {
    if (onPinMessage) onPinMessage(id);
    else {
      const msg = messages.find((m) => m.id === id);
      if (msg) {
        await supabase.from("chat_messages").update({ is_pinned: !msg.is_pinned }).eq("id", id);
      }
    }
  }, [messages, onPinMessage]);

  const handleDelete = useCallback(async (id: string) => {
    if (onDeleteMessage) onDeleteMessage(id);
    else {
      await supabase.from("chat_messages").delete().eq("id", id);
    }
  }, [onDeleteMessage]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <div className="relative flex h-full flex-col bg-card/50">
      {/* Leaderboard overlay */}
      <ChatLeaderboard isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 tv:px-6 tv:py-4">
        <div className="flex items-center gap-2 tv:gap-3">
          <div className="flex h-8 w-8 tv:h-12 tv:w-12 items-center justify-center rounded-lg bg-primary/10">
            <span className="text-sm tv:text-xl">💬</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tv:text-lg">Live Chat</h3>
            {!isLive && (
              <p className="text-[10px] text-warning tv:text-xs">Stream offline · chat tetap aktif</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className={`flex items-center justify-center rounded-full p-1.5 transition ${showLeaderboard ? "bg-warning/20 text-warning" : "text-muted-foreground hover:text-warning hover:bg-warning/10"}`}
            title="Leaderboard"
          >
            <Trophy className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 tv:px-4 tv:py-1.5">
            <Users className="h-3 w-3 tv:h-4 tv:w-4 text-success" />
            <span className="text-xs font-bold text-success tv:text-sm">{onlineCount}</span>
          </div>
        </div>
      </div>

      {/* Pinned messages */}
      {pinnedMessages.length > 0 && (
        <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 tv:px-6 tv:py-3 space-y-1 tv:space-y-2">
          {pinnedMessages.map((m) => (
            <div key={m.id} className="flex items-start gap-2 text-xs tv:text-sm">
              <Pin className="mt-0.5 h-3 w-3 tv:h-4 tv:w-4 text-primary shrink-0" />
              <div>
                <span className="font-bold text-primary">{m.username}</span>
                <span className="ml-1 text-foreground/80">{m.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 tv:px-4 tv:py-3 space-y-0.5 tv:space-y-1">
        {messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            msg={msg}
            isAdmin={isAdmin}
            isChatMod={isChatMod}
            chatModUsernames={chatModUsernames}
            onPin={handlePin}
            onDelete={handleDelete}
            onBlock={onBlockUser}
            onToggleMod={onToggleChatMod}
            formatTime={formatTime}
          />
        ))}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-3xl tv:text-5xl">💬</span>
            <p className="mt-2 text-xs text-muted-foreground tv:text-base">Belum ada pesan. Mulai percakapan!</p>
          </div>
        )}
      </div>

      {/* Input */}
      {!hasSession && !isAdmin && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-warning/10 px-3 py-2 text-[11px] tv:text-sm">
          <span className="text-warning">Login dulu untuk ikut komentar di live chat.</span>
          <a
            href={`/auth?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}
            className="inline-flex items-center gap-1 rounded-md bg-warning/20 px-2 py-1 font-semibold text-warning hover:bg-warning/30"
          >
            <LogIn className="h-3 w-3" /> Login
          </a>
        </div>
      )}
      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-border bg-card p-3 tv:p-4 tv:gap-3">
        <Input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={!username ? "Masukkan username dulu" : (!hasSession && !isAdmin) ? "Login untuk komentar..." : "Ketik pesan..."}
          disabled={!username || sending}
          className="flex-1 border-secondary bg-secondary/50 text-sm placeholder:text-muted-foreground/50 focus:bg-background tv:h-12 tv:text-base"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!username || sending || !newMessage.trim()}
          className="h-10 w-10 tv:h-12 tv:w-12 shrink-0 rounded-lg"
        >
          <Send className="h-4 w-4 tv:h-5 tv:w-5" />
        </Button>
      </form>
    </div>
  );
};

export default LiveChat;
