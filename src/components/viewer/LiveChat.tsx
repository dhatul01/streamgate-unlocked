import { useState, useEffect, useRef, useCallback, useTransition, memo, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Pin, PinOff, Trash2, ShieldBan, ShieldPlus, ShieldMinus, Users, Trophy, LogIn, Reply, X } from "lucide-react";
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
  reply_to_id: string | null;
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

const ChatMessageItem = memo(({ msg, replyTarget, isAdmin, isChatMod, chatModUsernames, onPin, onDelete, onBlock, onToggleMod, onReply, formatTime }: {
  msg: ChatMessage;
  replyTarget?: ChatMessage | null;
  isAdmin: boolean;
  isChatMod: boolean;
  chatModUsernames: Set<string>;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onBlock?: (tokenId: string) => void;
  onToggleMod?: (username: string, isMod: boolean) => void;
  onReply: (msg: ChatMessage) => void;
  formatTime: (d: string) => string;
}) => {
  const canModerate = isAdmin || isChatMod;
  const isMsgFromMod = chatModUsernames.has(msg.username);

  return (
    <div id={`msg-${msg.id}`} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 tv:px-3 tv:py-2.5 text-sm transition-colors hover:bg-secondary/30">
      <div className="flex-1 min-w-0">
        {replyTarget && (
          <div className="mb-1 flex items-start gap-1.5 border-l-2 border-primary/50 bg-primary/5 rounded-r px-2 py-1 text-[10px] tv:text-xs">
            <Reply className="mt-0.5 h-2.5 w-2.5 tv:h-3 tv:w-3 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-primary">{replyTarget.username}</span>
              <span className="ml-1 text-muted-foreground line-clamp-1">{replyTarget.message}</span>
            </div>
          </div>
        )}
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
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <button onClick={() => onReply(msg)} className="rounded p-1 tv:p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" title="Balas">
          <Reply className="h-3 w-3 tv:h-4 tv:w-4" />
        </button>
        {canModerate && (
          <>
            {isAdmin && (
              <button onClick={() => onPin(msg.id)} className="rounded p-1 tv:p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" title={msg.is_pinned ? "Unpin" : "Pin"}>
                {msg.is_pinned ? <PinOff className="h-3 w-3 tv:h-4 tv:w-4" /> : <Pin className="h-3 w-3 tv:h-4 tv:w-4" />}
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
            {isAdmin && !msg.is_admin && onToggleMod && (
              <button
                onClick={() => onToggleMod(msg.username, isMsgFromMod)}
                className={`rounded p-1 tv:p-1.5 text-muted-foreground ${isMsgFromMod ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-cyan-500/10 hover:text-cyan-400"}`}
                title={isMsgFromMod ? "Hapus Moderator" : "Jadikan Moderator"}
              >
                {isMsgFromMod ? <ShieldMinus className="h-3 w-3 tv:h-4 tv:w-4" /> : <ShieldPlus className="h-3 w-3 tv:h-4 tv:w-4" />}
              </button>
            )}
          </>
        )}
      </div>
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
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [guestUsername, setGuestUsername] = useState<string>(() => {
    try { return localStorage.getItem("guest_chat_username") || ""; } catch { return ""; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const presenceChannelRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const effectiveUsername = (username && username.trim()) || guestUsername.trim();
  const isGuest = !hasSession && !isAdmin;
  const isChatMod = chatModUsernames.has(effectiveUsername);

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

  useEffect(() => {
    if (!effectiveUsername) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: effectiveUsername } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        startTransition(() => setOnlineCount(Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user: effectiveUsername, joined_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUsername]);

  useEffect(() => {
    const fetchMessages = async () => {
      const [recentRes, pinnedRes] = await Promise.all([
        supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(60),
        supabase.from("chat_messages").select("*").eq("is_pinned", true).order("created_at", { ascending: false }).limit(20),
      ]);
      const recent = recentRes.data ? [...recentRes.data].reverse() : [];
      const pinned = pinnedRes.data || [];
      startTransition(() => {
        setMessages(recent as ChatMessage[]);
        setPinnedMessages(pinned as ChatMessage[]);
      });
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

  // Lookup map for reply targets (search both recent + pinned)
  const replyLookup = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) map.set(m.id, m);
    for (const m of pinnedMessages) map.set(m.id, m);
    return map;
  }, [messages, pinnedMessages]);

  // For reply targets that fell off the 30-msg window, fetch on-demand
  const [extraReplyTargets, setExtraReplyTargets] = useState<Map<string, ChatMessage>>(new Map());
  useEffect(() => {
    const missing = new Set<string>();
    for (const m of messages) {
      if (m.reply_to_id && !replyLookup.has(m.reply_to_id) && !extraReplyTargets.has(m.reply_to_id)) {
        missing.add(m.reply_to_id);
      }
    }
    if (missing.size === 0) return;
    (async () => {
      const ids = Array.from(missing);
      const { data } = await supabase.from("chat_messages").select("*").in("id", ids);
      if (data && data.length) {
        setExtraReplyTargets((prev) => {
          const next = new Map(prev);
          for (const m of data as ChatMessage[]) next.set(m.id, m);
          return next;
        });
      }
    })();
  }, [messages, replyLookup, extraReplyTargets]);

  const lastSentRef = useRef(0);

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const finalName = effectiveUsername;
    if (!finalName) {
      toast.error("Masukkan username dulu untuk berkomentar");
      return;
    }
    if (isGuest) {
      if (finalName.length < 2 || finalName.length > 24 || !/^[A-Za-z0-9_. -]+$/.test(finalName)) {
        toast.error("Username 2-24 karakter (huruf/angka/_.-/spasi)");
        return;
      }
      try { localStorage.setItem("guest_chat_username", finalName); } catch {}
    }

    const now = Date.now();
    if (now - lastSentRef.current < 2000) {
      toast.info("Tunggu sebentar sebelum kirim pesan lagi");
      return;
    }
    lastSentRef.current = now;

    setSending(true);

    const insertData: any = {
      username: finalName,
      message: newMessage.trim(),
      token_id: isGuest ? null : (tokenId || null),
      reply_to_id: replyingTo?.id || null,
    };
    if (isAdmin) {
      insertData.is_admin = true;
    }
    const { error } = await supabase.from("chat_messages").insert(insertData);

    if (error) {
      toast.error("Gagal mengirim pesan", { description: error.message });
      lastSentRef.current = 0;
    } else {
      setNewMessage("");
      setReplyingTo(null);
    }
    setSending(false);
    inputRef.current?.focus();
  }, [newMessage, effectiveUsername, isGuest, tokenId, isAdmin, replyingTo]);

  const handlePin = useCallback(async (id: string) => {
    if (onPinMessage) onPinMessage(id);
    else {
      // Toggle from local state (covers pinned-only items not in messages window)
      const m = messages.find((x) => x.id === id) || pinnedMessages.find((x) => x.id === id);
      const next = m ? !m.is_pinned : true;
      await supabase.from("chat_messages").update({ is_pinned: next }).eq("id", id);
    }
  }, [messages, pinnedMessages, onPinMessage]);

  const handleUnpinFromLog = useCallback(async (id: string) => {
    await supabase.from("chat_messages").update({ is_pinned: false }).eq("id", id);
    // Optimistic update
    setPinnedMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (onDeleteMessage) onDeleteMessage(id);
    else {
      await supabase.from("chat_messages").delete().eq("id", id);
    }
  }, [onDeleteMessage]);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  }, []);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <div className="relative flex h-full flex-col bg-card/50">
      <ChatLeaderboard isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />

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

      {/* Pinned messages log — admin can unpin directly without scrolling chat */}
      {pinnedMessages.length > 0 && (
        <div className="border-b border-primary/20 bg-primary/5 px-3 py-2 tv:px-5 tv:py-3 space-y-1 tv:space-y-2 max-h-[20%] overflow-y-auto">
          {pinnedMessages.map((m) => (
            <div key={m.id} className="group flex items-start gap-2 text-xs tv:text-sm">
              <Pin className="mt-0.5 h-3 w-3 tv:h-4 tv:w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-bold text-primary">{m.username}</span>
                <span className="ml-1 text-foreground/80 break-words">{m.message}</span>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleUnpinFromLog(m.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  title="Unpin pesan"
                  aria-label="Unpin pesan"
                >
                  <PinOff className="h-3 w-3 tv:h-4 tv:w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 tv:px-4 tv:py-3 space-y-0.5 tv:space-y-1">
        {messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            msg={msg}
            replyTarget={msg.reply_to_id ? (replyLookup.get(msg.reply_to_id) || extraReplyTargets.get(msg.reply_to_id) || null) : null}
            isAdmin={isAdmin}
            isChatMod={isChatMod}
            chatModUsernames={chatModUsernames}
            onPin={handlePin}
            onDelete={handleDelete}
            onBlock={onBlockUser}
            onToggleMod={onToggleChatMod}
            onReply={handleReply}
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

      {/* Reply composer banner */}
      {replyingTo && (
        <div className="flex items-start gap-2 border-t border-primary/30 bg-primary/10 px-3 py-2 tv:px-4 tv:py-3">
          <Reply className="mt-0.5 h-3.5 w-3.5 tv:h-4 tv:w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] tv:text-xs font-semibold text-primary">
              Membalas {replyingTo.username}
            </p>
            <p className="truncate text-xs tv:text-sm text-muted-foreground">{replyingTo.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Batal balas"
          >
            <X className="h-3.5 w-3.5 tv:h-4 tv:w-4" />
          </button>
        </div>
      )}

      {isGuest && !username && (
        <div className="flex items-center gap-2 border-t border-border bg-secondary/30 px-3 py-2 tv:px-4 tv:py-3">
          <Input
            value={guestUsername}
            onChange={(e) => setGuestUsername(e.target.value.slice(0, 24))}
            placeholder="Username untuk komentar (2-24 karakter)"
            maxLength={24}
            className="h-9 flex-1 border-secondary bg-background text-xs tv:h-11 tv:text-sm"
          />
          <a
            href={`/auth?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 tv:text-xs"
            title="Login untuk badge dan koin"
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
          placeholder={!effectiveUsername ? "Masukkan username dulu" : replyingTo ? `Balas ke ${replyingTo.username}...` : "Ketik pesan..."}
          disabled={!effectiveUsername || sending}
          maxLength={300}
          className="flex-1 border-secondary bg-secondary/50 text-sm placeholder:text-muted-foreground/50 focus:bg-background tv:h-12 tv:text-base"
        />
        <Button
          type="submit"
          disabled={!effectiveUsername || !newMessage.trim() || sending}
          size="icon"
          className="h-10 w-10 shrink-0 tv:h-12 tv:w-12"
        >
          <Send className="h-4 w-4 tv:h-5 tv:w-5" />
        </Button>
      </form>
    </div>
  );
};

export default LiveChat;
