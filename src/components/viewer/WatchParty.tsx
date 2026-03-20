import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VideoPlayerHandle } from "./VideoPlayer";

interface WatchPartyProps {
  username: string;
  playerRef: React.RefObject<VideoPlayerHandle | null>;
  isLive: boolean;
}

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const WatchParty = ({ username, playerRef, isLive }: WatchPartyProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [party, setParty] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const createRoom = async () => {
    setError("");
    const code = generateCode();
    const { data, error: err } = await supabase
      .from("watch_parties")
      .insert({ room_code: code, host_username: username })
      .select()
      .single();
    if (err || !data) { setError("Gagal membuat room"); return; }
    setParty(data);
    setIsHost(true);
    await supabase.from("watch_party_members").insert({ party_id: data.id, username });
  };

  const joinRoom = async () => {
    setError("");
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) { setError("Masukkan kode room"); return; }
    const { data, error: err } = await supabase
      .from("watch_parties")
      .select("*")
      .eq("room_code", trimmed)
      .eq("is_active", true)
      .maybeSingle();
    if (err || !data) { setError("Room tidak ditemukan"); return; }
    setParty(data);
    setIsHost(false);
    await supabase.from("watch_party_members").upsert(
      { party_id: data.id, username },
      { onConflict: "party_id,username" }
    );
  };

  const leaveRoom = async () => {
    if (!party) return;
    if (isHost) {
      await supabase.from("watch_parties").update({ is_active: false }).eq("id", party.id);
    } else {
      await supabase.from("watch_party_members").delete()
        .eq("party_id", party.id).eq("username", username);
    }
    setParty(null);
    setIsHost(false);
    setMembers([]);
  };

  const copyCode = useCallback(() => {
    if (!party?.room_code) return;
    navigator.clipboard.writeText(party.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [party?.room_code]);

  // Fetch & subscribe to members
  useEffect(() => {
    if (!party) return;

    const fetchMembers = async () => {
      const { data } = await supabase
        .from("watch_party_members")
        .select("*")
        .eq("party_id", party.id)
        .order("joined_at");
      if (data) setMembers(data);
    };
    fetchMembers();

    const channel = supabase
      .channel(`party-members-${party.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "watch_party_members", filter: `party_id=eq.${party.id}` }, () => fetchMembers())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [party?.id]);

  // Listen for party deactivation (host left)
  useEffect(() => {
    if (!party || isHost) return;

    const channel = supabase
      .channel(`party-state-${party.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "watch_parties", filter: `id=eq.${party.id}`
      }, (payload: any) => {
        if (!payload.new.is_active) {
          setParty(null);
          setIsHost(false);
          setMembers([]);
          setError("Host telah menutup room");
        }
        // Sync playback for non-live content
        if (!isLive && playerRef.current) {
          const { playback_position, is_playing } = payload.new;
          playerRef.current.seekTo?.(playback_position || 0);
          if (is_playing) playerRef.current.play();
          else playerRef.current.pause();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [party?.id, isHost, isLive, playerRef]);

  // Host: sync playback position every 5s (non-live only)
  useEffect(() => {
    if (!isHost || !party || isLive) return;
    syncIntervalRef.current = setInterval(() => {
      if (!playerRef.current) return;
      const time = playerRef.current.getCurrentTime?.() || 0;
      supabase.from("watch_parties").update({
        playback_position: time,
        is_playing: true,
      }).eq("id", party.id).then(() => {});
    }, 5000);
    return () => clearInterval(syncIntervalRef.current);
  }, [isHost, party?.id, isLive, playerRef]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-accent/80 px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:bg-accent tv:px-5 tv:py-2.5 tv:text-base"
      >
        🎉 Watch Party
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 tv:p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground tv:text-lg">🎉 Watch Party</h3>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
      </div>

      {error && (
        <p className="mb-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive tv:text-sm">{error}</p>
      )}

      {!party ? (
        <div className="space-y-3">
          <button
            onClick={createRoom}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 tv:text-base"
          >
            🏠 Buat Room Baru
          </button>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-muted-foreground tv:text-xs">atau</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Kode Room"
              maxLength={6}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono uppercase tracking-widest text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv:text-base"
            />
            <button
              onClick={joinRoom}
              className="rounded-lg bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80 tv:text-base"
            >
              Gabung
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Room code */}
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 tv:px-5 tv:py-3">
            <span className="text-[10px] text-muted-foreground tv:text-xs">Kode:</span>
            <span className="font-mono text-lg font-bold tracking-[0.3em] text-primary tv:text-2xl">{party.room_code}</span>
            <button
              onClick={copyCode}
              className="ml-auto rounded-md bg-primary/20 px-2 py-1 text-[10px] font-medium text-primary transition hover:bg-primary/30 tv:text-xs"
            >
              {copied ? "✓ Disalin" : "📋 Salin"}
            </button>
          </div>

          {/* Host badge */}
          {isHost && (
            <p className="text-[10px] text-muted-foreground tv:text-xs">
              👑 Kamu adalah host • {isLive ? "Live mode — semua tersinkron" : "Playback tersinkron ke semua member"}
            </p>
          )}

          {/* Members */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider tv:text-xs">
              Penonton ({members.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <span
                  key={m.id}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium tv:text-xs ${
                    m.username === party.host_username
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {m.username === party.host_username && "👑 "}
                  {m.username}
                </span>
              ))}
            </div>
          </div>

          {/* Leave */}
          <button
            onClick={leaveRoom}
            className="w-full rounded-lg border border-destructive/30 px-4 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/10 tv:text-base"
          >
            {isHost ? "🔴 Tutup Room" : "🚪 Keluar Room"}
          </button>
        </div>
      )}
    </div>
  );
};

export default WatchParty;
