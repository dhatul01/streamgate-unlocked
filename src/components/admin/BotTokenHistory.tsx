import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCcw, Trash2, Ban, Play, Bot } from "lucide-react";

type Token = {
  id: string;
  code: string;
  duration_type: string;
  status: string;
  expires_at: string;
  replay_expires_at: string | null;
  created_at: string;
  max_devices: number;
  show_id: string | null;
  created_by_reseller_id: string | null;
  locked_fingerprint: string | null;
};

const BotTokenHistory = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [resellers, setResellers] = useState<Record<string, string>>({});
  const [shows, setShows] = useState<Record<string, string>>({});
  const [botTokenIds, setBotTokenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilter, setShowFilter] = useState<string>("all");
  const [resellerFilter, setResellerFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data: tk }, { data: rs }, { data: sh }, { data: logs }] = await Promise.all([
      supabase.from("tokens").select("*").not("created_by_reseller_id", "is", null).order("created_at", { ascending: false }).limit(500),
      supabase.from("resellers").select("id, username, prefix"),
      supabase.from("shows").select("id, title"),
      supabase.from("reseller_audit_logs").select("target_token_id, metadata").eq("action", "create_token_bot").limit(1000),
    ]);
    setTokens((tk as Token[]) || []);
    const rmap: Record<string, string> = {};
    (rs || []).forEach((r: any) => { rmap[r.id] = `@${r.username} [${r.prefix}]`; });
    setResellers(rmap);
    const smap: Record<string, string> = {};
    (sh || []).forEach((s: any) => { smap[s.id] = s.title; });
    setShows(smap);
    const ids = new Set<string>();
    (logs || []).forEach((l: any) => { if (l.target_token_id) ids.add(l.target_token_id); });
    setBotTokenIds(ids);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => tokens.filter((t) => {
    if (!botTokenIds.has(t.id)) return false; // only bot-created
    if (statusFilter === "active" && (t.status !== "active" || new Date(t.expires_at) < new Date())) return false;
    if (statusFilter === "expired" && new Date(t.expires_at) >= new Date() && t.status === "active") return false;
    if (statusFilter === "blocked" && t.status !== "blocked") return false;
    if (showFilter !== "all" && t.show_id !== showFilter) return false;
    if (resellerFilter !== "all" && t.created_by_reseller_id !== resellerFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${t.code} ${shows[t.show_id || ""] || ""} ${resellers[t.created_by_reseller_id || ""] || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [tokens, botTokenIds, statusFilter, showFilter, resellerFilter, search, shows, resellers]);

  const tokenStatus = (t: Token) => {
    if (t.status === "blocked") return <Badge variant="destructive">Diblokir</Badge>;
    if (new Date(t.expires_at) < new Date()) return <Badge variant="outline">Expired</Badge>;
    return <Badge className="bg-green-600">Aktif</Badge>;
  };

  const resetDevice = async (id: string) => {
    const { error } = await supabase.from("tokens").update({ locked_fingerprint: null }).eq("id", id);
    if (error) return toast.error("Gagal reset perangkat");
    await supabase.from("token_sessions").delete().eq("token_id", id);
    toast.success("Perangkat token direset");
    load();
  };

  const toggleBlock = async (t: Token) => {
    const newStatus = t.status === "blocked" ? "active" : "blocked";
    const { error } = await supabase.from("tokens").update({ status: newStatus }).eq("id", t.id);
    if (error) return toast.error("Gagal ubah status");
    toast.success(newStatus === "blocked" ? "Token diblokir" : "Token diaktifkan");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus token ini permanen? Token akan invalid untuk live & replay.")) return;
    const { error } = await supabase.from("tokens").delete().eq("id", id);
    if (error) return toast.error("Gagal hapus token");
    toast.success("Token dihapus");
    load();
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Riwayat Token Bot Reseller</h2>
        <Button size="sm" variant="ghost" onClick={load} className="ml-auto">
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Cari kode / show / reseller..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="blocked">Diblokir</SelectItem>
          </SelectContent>
        </Select>
        <Select value={showFilter} onValueChange={setShowFilter}>
          <SelectTrigger><SelectValue placeholder="Show" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua show</SelectItem>
            {Object.entries(shows).map(([id, title]) => (
              <SelectItem key={id} value={id}>{title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resellerFilter} onValueChange={setResellerFilter}>
          <SelectTrigger><SelectValue placeholder="Reseller" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua reseller</SelectItem>
            {Object.entries(resellers).map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        Menampilkan {filtered.length} token (dari {tokens.length} token reseller, {botTokenIds.size} via bot)
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dibuat</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Aktif s/d</TableHead>
              <TableHead>Replay s/d</TableHead>
              <TableHead>Show</TableHead>
              <TableHead>Reseller</TableHead>
              <TableHead>Max Dev</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Memuat...</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Tidak ada token</TableCell></TableRow>}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(t.created_at).toLocaleString("id-ID")}</TableCell>
                <TableCell className="font-mono text-xs">{t.code}</TableCell>
                <TableCell>{tokenStatus(t)}</TableCell>
                <TableCell className="text-xs">{t.duration_type}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{new Date(t.expires_at).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{t.replay_expires_at ? new Date(t.replay_expires_at).toLocaleString("id-ID") : "—"}</TableCell>
                <TableCell className="text-xs">{shows[t.show_id || ""] || "—"}</TableCell>
                <TableCell className="text-xs">{resellers[t.created_by_reseller_id || ""] || "—"}</TableCell>
                <TableCell className="text-xs">{t.max_devices}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" title="Reset perangkat" onClick={() => resetDevice(t.id)}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" title={t.status === "blocked" ? "Aktifkan" : "Blokir"} onClick={() => toggleBlock(t)}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Hapus" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default BotTokenHistory;
