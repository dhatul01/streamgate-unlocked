import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Ban, RefreshCw, Plus, Search, Globe, Lock, ClipboardList, CheckCircle } from "lucide-react";

const TokenFactory = () => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [sessions, setSessions] = useState<Record<string, number>>({});
  const [duration, setDuration] = useState("daily");
  const [maxDevices, setMaxDevices] = useState("1");
  const [bulkCount, setBulkCount] = useState("1");
  const [isPublic, setIsPublic] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "expired">("all");
  const [generating, setGenerating] = useState(false);
  const [copiedTokens, setCopiedTokens] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("rt48_copied_tokens");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const { toast } = useToast();

  const fetchTokens = async () => {
    // Fetch all tokens, then exclude moderator-created ones
    const [tokensRes, modLogsRes] = await Promise.all([
      supabase.from("tokens").select("*").order("created_at", { ascending: false }),
      supabase.from("moderator_token_logs").select("token_id"),
    ]);
    
    const modTokenIds = new Set((modLogsRes.data || []).map((l: any) => l.token_id));
    const adminTokens = (tokensRes.data || []).filter((t: any) => !modTokenIds.has(t.id));
    setTokens(adminTokens);
    
    // Fetch session counts
    const { data: sessData } = await supabase.from("token_sessions").select("token_id");
    if (sessData) {
      const counts: Record<string, number> = {};
      sessData.forEach((s: any) => {
        counts[s.token_id] = (counts[s.token_id] || 0) + 1;
      });
      setSessions(counts);
    }
  };

  useEffect(() => {
    fetchTokens();
    // Realtime: refresh when tokens or moderator_token_logs change
    const channel = supabase
      .channel("admin-token-factory")
      .on("postgres_changes", { event: "*", schema: "public", table: "tokens" }, () => fetchTokens())
      .on("postgres_changes", { event: "*", schema: "public", table: "moderator_token_logs" }, () => fetchTokens())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const generateToken = async () => {
    const count = Math.max(1, Math.min(100, parseInt(bulkCount) || 1));
    setGenerating(true);
    const now = new Date();
    let expiresAt: Date;
    if (duration === "daily") expiresAt = new Date(now.getTime() + 86400000);
    else if (duration === "weekly") expiresAt = new Date(now.getTime() + 604800000);
    else expiresAt = new Date(now.getTime() + 2592000000);

    const rows = Array.from({ length: count }, () => ({
      code: `rt48_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      max_devices: isPublic ? 9999 : parseInt(maxDevices),
      duration_type: duration,
      expires_at: expiresAt.toISOString(),
      is_public: isPublic,
    }));

    await supabase.from("tokens").insert(rows);
    await fetchTokens();
    toast({ title: `${count} token berhasil dibuat!` });
    setGenerating(false);
  };

  const markAsCopied = (code: string) => {
    setCopiedTokens((prev) => {
      const next = new Set(prev);
      next.add(code);
      localStorage.setItem("rt48_copied_tokens", JSON.stringify([...next]));
      return next;
    });
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/live?t=${code}`;
    navigator.clipboard.writeText(link);
    markAsCopied(code);
    toast({ title: "Link disalin!" });
  };

  const bulkCopyUncopiedDaily = () => {
    const dailyUncopied = tokens.filter(
      (t) => t.duration_type === "daily" && !copiedTokens.has(t.code) && t.status !== "blocked" && !isExpired(t)
    );
    if (dailyUncopied.length === 0) {
      toast({ title: "Tidak ada token harian baru untuk disalin" });
      return;
    }
    const links = dailyUncopied.map((t) => `${window.location.origin}/live?t=${t.code}`).join("\n");
    navigator.clipboard.writeText(links);
    dailyUncopied.forEach((t) => markAsCopied(t.code));
    toast({ title: `${dailyUncopied.length} link token harian disalin!` });
  };

  const blockToken = async (id: string) => {
    const token = tokens.find(t => t.id === id);
    const newStatus = token?.status === "blocked" ? "active" : "blocked";
    await supabase.from("tokens").update({ status: newStatus }).eq("id", id);
    await fetchTokens();
    toast({ title: newStatus === "blocked" ? "Token diblokir" : "Token diaktifkan kembali" });
  };

  const resetSessions = async (id: string) => {
    await supabase.from("token_sessions").delete().eq("token_id", id);
    toast({ title: "Session direset" });
  };

  const [deleting, setDeleting] = useState(false);

  const deleteTokens = async (ids: string[]) => {
    if (deleting || ids.length === 0) return;
    setDeleting(true);
    try {
      // Delete related records first (FK constraints), then tokens - batch by using .in()
      await supabase.from("blocked_users").delete().in("token_id", ids);
      await supabase.from("chat_messages").delete().in("token_id", ids);
      await supabase.from("token_sessions").delete().in("token_id", ids);
      await supabase.from("tokens").delete().in("id", ids);
      setSelected(new Set());
      await fetchTokens();
      toast({ title: `${ids.length} token dihapus` });
    } catch (err) {
      toast({ title: "Gagal menghapus token", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredTokens.length) setSelected(new Set());
    else setSelected(new Set(filteredTokens.map((t) => t.id)));
  };

  const isExpired = (t: any) => new Date(t.expires_at) < new Date();

  const filteredTokens = tokens.filter((t) => {
    const matchSearch = t.code.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "blocked") return t.status === "blocked";
    if (statusFilter === "expired") return t.status !== "blocked" && isExpired(t);
    if (statusFilter === "active") return t.status !== "blocked" && !isExpired(t);
    return true;
  });

  const countByStatus = {
    all: tokens.length,
    active: tokens.filter(t => t.status !== "blocked" && !isExpired(t)).length,
    blocked: tokens.filter(t => t.status === "blocked").length,
    expired: tokens.filter(t => t.status !== "blocked" && isExpired(t)).length,
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">🔑 Token Factory</h2>

      {/* Generate */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipe</label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            <span className="text-xs font-medium text-foreground">
              {isPublic ? (
                <span className="flex items-center gap-1"><Globe className="h-3 w-3 text-success" /> Publik</span>
              ) : (
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Private</span>
              )}
            </span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Durasi</label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="w-32 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">1 Hari</SelectItem>
              <SelectItem value="weekly">7 Hari</SelectItem>
              <SelectItem value="monthly">30 Hari</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isPublic && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Device</label>
            <Select value={maxDevices} onValueChange={setMaxDevices}>
              <SelectTrigger className="w-24 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Jumlah</label>
          <Input
            type="number"
            min="1"
            max="100"
            value={bulkCount}
            onChange={(e) => setBulkCount(e.target.value)}
            className="w-20 bg-background"
          />
        </div>
        <Button onClick={generateToken} disabled={generating}>
          <Plus className="mr-1 h-4 w-4" /> Generate {parseInt(bulkCount) > 1 ? `${bulkCount} Token` : "Token"}
        </Button>
      </div>

      {isPublic && (
        <p className="text-xs text-muted-foreground">
          ℹ️ Token publik dapat digunakan oleh banyak user tanpa batas perangkat.
        </p>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "all", label: "Semua", icon: null },
          { key: "active", label: "Aktif", icon: "🟢" },
          { key: "blocked", label: "Diblokir", icon: "🔴" },
          { key: "expired", label: "Expired", icon: "🟡" },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => { setStatusFilter(key); setSelected(new Set()); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            {icon && <span>{icon}</span>}
            {label}
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              statusFilter === key ? "bg-primary-foreground/20" : "bg-muted"
            }`}>
              {countByStatus[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search & bulk actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari token..."
            className="bg-card pl-9"
          />
        </div>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" disabled={deleting} onClick={() => deleteTokens(Array.from(selected))}>
            <Trash2 className="mr-1 h-3 w-3" /> Hapus ({selected.size})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={bulkCopyUncopiedDaily} title="Salin semua token harian yang belum pernah disalin">
          <ClipboardList className="mr-1 h-3 w-3" /> Salin Token Harian Baru
        </Button>
      </div>

      {/* Token list */}
      <div className="space-y-2">
        {filteredTokens.length > 0 && (
          <div className="flex items-center gap-2 px-2">
            <Checkbox
              checked={selected.size === filteredTokens.length && filteredTokens.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-muted-foreground">Pilih semua</span>
          </div>
        )}

        {filteredTokens.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Checkbox
              checked={selected.has(t.id)}
              onCheckedChange={() => toggleSelect(t.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm font-semibold text-foreground truncate">{t.code}</p>
                {t.is_public && (
                  <span className="flex items-center gap-0.5 rounded-sm bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    <Globe className="h-2.5 w-2.5" /> PUBLIK
                  </span>
                )}
                {copiedTokens.has(t.code) && (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    ✓ tersalin
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                  t.status === "blocked"
                    ? "bg-destructive/20 text-destructive"
                    : isExpired(t)
                    ? "bg-warning/20 text-warning"
                    : "bg-success/20 text-success"
                }`}>
                  {t.status === "blocked" ? "BLOCKED" : isExpired(t) ? "EXPIRED" : "ACTIVE"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t.duration_type} {!t.is_public && `· ${t.max_devices} device`}
                </span>
                {(sessions[t.id] || 0) > 0 && (
                  <span className="flex items-center gap-0.5 rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    👤 {sessions[t.id]} aktif
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(t.code)} title="Copy link">
                <Copy className="h-3 w-3" />
              </Button>
              {!t.is_public && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resetSessions(t.id)} title="Reset session">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => blockToken(t.id)} title={t.status === "blocked" ? "Aktifkan" : "Blokir"}>
                {t.status === "blocked" ? <CheckCircle className="h-3 w-3 text-success" /> : <Ban className="h-3 w-3 text-destructive" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={deleting} onClick={() => deleteTokens([t.id])} title="Hapus">
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {filteredTokens.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada token</p>
        )}
      </div>
    </div>
  );
};

export default TokenFactory;
