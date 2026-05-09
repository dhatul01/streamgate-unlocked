import { useState, useEffect, useCallback, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldOff, Search, RefreshCw, Globe, Ban, AlertTriangle,
  Eye, Users, Activity, Trash2, Lock, Unlock,
} from "lucide-react";

interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string;
  violation_count: number;
  is_active: boolean;
  auto_blocked: boolean;
  blocked_at: string;
  unblocked_at: string | null;
  unblocked_by: string | null;
}

interface VisitLog {
  id: string;
  ip_address: string;
  user_agent: string | null;
  path: string | null;
  visit_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

interface Violation {
  id: string;
  ip_address: string;
  endpoint: string;
  violation_key: string;
  created_at: string;
}

type Tab = "visitors" | "blocked" | "violations";

const formatTimeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
};

const IpManager = forwardRef<HTMLDivElement>((_, ref) => {
  const [tab, setTab] = useState<Tab>("visitors");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<BlockedIp[]>([]);
  const [visits, setVisits] = useState<VisitLog[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [b, v, r] = await Promise.all([
      supabase.from("blocked_ips").select("*").order("blocked_at", { ascending: false }).limit(200),
      supabase.from("ip_visit_log").select("*").order("last_seen_at", { ascending: false }).limit(200),
      supabase.from("rate_limit_violations").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (b.error) toast.error("Gagal load blocked: " + b.error.message);
    setBlocked((b.data as any) || []);
    setVisits((v.data as any) || []);
    setViolations((r.data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const blockIp = async (ip: string, reason: string, auto = false) => {
    if (!ip.trim()) return toast.error("IP tidak boleh kosong");
    setBusy(true);
    const existing = blocked.find((b) => b.ip_address === ip.trim());
    if (existing) {
      const { error } = await supabase.from("blocked_ips").update({
        is_active: true,
        unblocked_at: null,
        unblocked_by: null,
        reason: reason || existing.reason,
        violation_count: existing.violation_count + 1,
        blocked_at: new Date().toISOString(),
      }).eq("id", existing.id);
      if (error) toast.error("Gagal: " + error.message);
      else toast.success(`IP ${ip} diblokir ulang`);
    } else {
      const { error } = await supabase.from("blocked_ips").insert({
        ip_address: ip.trim(),
        reason: reason || (auto ? "auto-block" : "manual block by admin"),
        auto_blocked: auto,
        is_active: true,
      });
      if (error) toast.error("Gagal: " + error.message);
      else toast.success(`IP ${ip} diblokir`);
    }
    setNewIp(""); setNewReason("");
    setBusy(false);
    fetchAll();
  };

  const unblockIp = async (item: BlockedIp) => {
    if (!confirm(`Buka blokir IP ${item.ip_address}?`)) return;
    const { error } = await supabase.from("blocked_ips").update({
      is_active: false,
      unblocked_at: new Date().toISOString(),
      unblocked_by: "admin",
    }).eq("id", item.id);
    if (error) toast.error("Gagal: " + error.message);
    else { toast.success("Dibuka"); fetchAll(); }
  };

  const deleteBlocked = async (item: BlockedIp) => {
    if (!confirm(`Hapus permanen entry IP ${item.ip_address}?`)) return;
    const { error } = await supabase.from("blocked_ips").delete().eq("id", item.id);
    if (error) toast.error("Gagal: " + error.message);
    else { toast.success("Dihapus"); fetchAll(); }
  };

  const filterFn = (text: string) => !search || text.toLowerCase().includes(search.toLowerCase());
  const filteredBlocked = blocked.filter((b) => filterFn(b.ip_address) || filterFn(b.reason));
  const filteredVisits = visits.filter((v) => filterFn(v.ip_address) || filterFn(v.path || "") || filterFn(v.user_agent || ""));
  const filteredViolations = violations.filter((v) => filterFn(v.ip_address) || filterFn(v.endpoint));

  const activeBlockedCount = blocked.filter((b) => b.is_active).length;
  const uniqueIpsCount = new Set(visits.map((v) => v.ip_address)).size;

  return (
    <div ref={ref} className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">IP Manager & Visitor Monitor</h2>
          <Button variant="outline" size="icon" onClick={fetchAll} disabled={loading} className="ml-auto h-8 w-8">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
            <Users className="mx-auto mb-1 h-4 w-4 text-primary" />
            <p className="text-lg font-bold text-foreground">{uniqueIpsCount}</p>
            <p className="text-[10px] text-muted-foreground">Unique IPs</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
            <Activity className="mx-auto mb-1 h-4 w-4 text-primary" />
            <p className="text-lg font-bold text-foreground">{visits.length}</p>
            <p className="text-[10px] text-muted-foreground">Visit Log</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
            <Ban className="mx-auto mb-1 h-4 w-4 text-destructive" />
            <p className="text-lg font-bold text-destructive">{activeBlockedCount}</p>
            <p className="text-[10px] text-muted-foreground">Blocked</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
            <AlertTriangle className="mx-auto mb-1 h-4 w-4 text-yellow-500" />
            <p className="text-lg font-bold text-yellow-500">{violations.length}</p>
            <p className="text-[10px] text-muted-foreground">Violations</p>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 p-3 sm:flex-row">
          <Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="IP address (contoh: 1.2.3.4)" className="bg-background font-mono" />
          <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Alasan (opsional)" className="bg-background" />
          <Button onClick={() => blockIp(newIp, newReason)} disabled={busy || !newIp.trim()} variant="destructive" className="shrink-0">
            <Lock className="mr-1 h-4 w-4" /> Block
          </Button>
        </div>

        <div className="mb-3 flex gap-1 rounded-lg bg-secondary/30 p-1">
          {([
            { id: "visitors", label: "Visitor Log", icon: Eye, count: visits.length },
            { id: "blocked", label: "Blocked", icon: Ban, count: activeBlockedCount },
            { id: "violations", label: "Violations", icon: AlertTriangle, count: violations.length },
          ] as { id: Tab; label: string; icon: any; count: number }[]).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                  tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <Badge variant={tab === t.id ? "secondary" : "outline"} className="ml-1 h-4 px-1 text-[10px]">{t.count}</Badge>
              </button>
            );
          })}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari IP / path / endpoint..." className="bg-background pl-10" />
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary/40" />
            ))}
          </div>
        ) : tab === "visitors" ? (
          filteredVisits.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada kunjungan tercatat.</p>
          ) : (
            <div className="space-y-2">
              {filteredVisits.map((v) => {
                const isBlocked = blocked.find((b) => b.ip_address === v.ip_address && b.is_active);
                return (
                  <div key={v.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-foreground">{v.ip_address}</span>
                          <Badge variant="outline" className="text-[10px]">{v.visit_count}x</Badge>
                          {isBlocked && <Badge variant="destructive" className="text-[10px]"><Ban className="mr-0.5 h-2.5 w-2.5" />blocked</Badge>}
                        </div>
                        {v.path && <p className="mt-0.5 truncate text-xs text-muted-foreground">📍 {v.path}</p>}
                        {v.user_agent && <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">{v.user_agent}</p>}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Pertama: {formatTimeAgo(v.first_seen_at)} · Terakhir: {formatTimeAgo(v.last_seen_at)}
                        </p>
                      </div>
                      {!isBlocked && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => blockIp(v.ip_address, `blocked from visitor log (${v.visit_count} visits)`)}
                          className="h-7 shrink-0 text-xs"
                        >
                          <Lock className="mr-1 h-3 w-3" /> Block
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === "blocked" ? (
          filteredBlocked.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada IP yang diblokir.</p>
          ) : (
            <div className="space-y-2">
              {filteredBlocked.map((b) => (
                <div key={b.id} className={`rounded-lg border p-3 ${
                  b.is_active ? "border-destructive/30 bg-destructive/5" : "border-border bg-secondary/20 opacity-70"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">{b.ip_address}</span>
                        {b.is_active ? (
                          <Badge variant="destructive" className="text-[10px]"><Ban className="mr-0.5 h-2.5 w-2.5" />active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">unblocked</Badge>
                        )}
                        {b.auto_blocked && <Badge className="bg-yellow-500/20 text-yellow-500 text-[10px]">auto</Badge>}
                        <Badge variant="outline" className="text-[10px]">{b.violation_count}x</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-foreground">{b.reason}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Diblokir: {formatTimeAgo(b.blocked_at)}
                        {b.unblocked_at && ` · Dibuka: ${formatTimeAgo(b.unblocked_at)} oleh ${b.unblocked_by || "?"}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {b.is_active ? (
                        <Button size="sm" variant="outline" onClick={() => unblockIp(b)} className="h-7 text-xs">
                          <Unlock className="mr-1 h-3 w-3" /> Unblock
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => blockIp(b.ip_address, b.reason)} className="h-7 text-xs">
                          <Lock className="mr-1 h-3 w-3" /> Block
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => deleteBlocked(b)} className="h-7 w-7 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          filteredViolations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pelanggaran rate-limit.</p>
          ) : (
            <div className="space-y-2">
              {filteredViolations.map((v) => {
                const isBlocked = blocked.find((b) => b.ip_address === v.ip_address && b.is_active);
                return (
                  <div key={v.id} className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                          <span className="font-mono text-sm font-semibold text-foreground">{v.ip_address}</span>
                          {isBlocked && <Badge variant="destructive" className="text-[10px]">blocked</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">→ {v.endpoint}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatTimeAgo(v.created_at)} · key: {v.violation_key}</p>
                      </div>
                      {!isBlocked && (
                        <Button size="sm" variant="destructive" onClick={() => blockIp(v.ip_address, `rate-limit violation: ${v.endpoint}`, true)} className="h-7 text-xs">
                          <ShieldOff className="mr-1 h-3 w-3" /> Block
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
});
IpManager.displayName = "IpManager";

export default IpManager;
