import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, RotateCcw, Trash2, ShieldOff, Film, Clock4, Lock, Unlock } from "lucide-react";

interface TokenRow {
  id: string;
  code: string;
  status: string;
  expires_at: string;
  replay_expires_at: string | null;
  duration_type: string;
  locked_fingerprint: string | null;
  created_at: string;
  show_id: string | null;
}

const statusOf = (t: TokenRow, blocked: boolean) => {
  if (blocked) return { label: "Diblokir", color: "bg-destructive/20 text-destructive" };
  const now = new Date();
  const liveOk = new Date(t.expires_at) > now;
  const replayOk = t.replay_expires_at && new Date(t.replay_expires_at) > now;
  if (liveOk) return { label: "Aktif (Live + Replay)", color: "bg-green-500/20 text-green-500" };
  if (replayOk) return { label: "Replay Saja", color: "bg-blue-500/20 text-blue-400" };
  return { label: "Kadaluarsa", color: "bg-muted text-muted-foreground" };
};

const fmt = (d: string | null) => d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";

const ReplayTokenManager = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("tokens")
      .select("id, code, status, expires_at, replay_expires_at, duration_type, locked_fingerprint, created_at, show_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (search.trim()) q = q.ilike("code", `%${search.trim()}%`);
    const { data, error } = await q;
    if (error) { toast({ title: "Gagal memuat token", description: error.message, variant: "destructive" }); setLoading(false); return; }
    setTokens((data || []) as TokenRow[]);

    const ids = (data || []).map((t: any) => t.id);
    if (ids.length) {
      const { data: bl } = await supabase.from("blocked_users").select("token_id").in("token_id", ids);
      setBlockedIds(new Set((bl || []).map((b: any) => b.token_id)));
    } else {
      setBlockedIds(new Set());
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const handleReset = async (t: TokenRow) => {
    const { error: e1 } = await supabase.from("tokens").update({ locked_fingerprint: null }).eq("id", t.id);
    const { error: e2 } = await supabase.from("token_sessions").delete().eq("token_id", t.id);
    if (e1 || e2) { toast({ title: "Reset gagal", description: (e1 || e2)?.message, variant: "destructive" }); return; }
    toast({ title: "Token direset", description: `Perangkat & sesi token ${t.code} dibersihkan.` });
    load();
  };

  const handleDelete = async (t: TokenRow) => {
    await supabase.from("token_sessions").delete().eq("token_id", t.id);
    await supabase.from("blocked_users").delete().eq("token_id", t.id);
    const { error } = await supabase.from("tokens").delete().eq("id", t.id);
    if (error) { toast({ title: "Hapus gagal", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Token dihapus" });
    load();
  };

  const handleBlock = async (t: TokenRow) => {
    const blocked = blockedIds.has(t.id);
    if (blocked) {
      const { error } = await supabase.from("blocked_users").delete().eq("token_id", t.id);
      if (error) { toast({ title: "Gagal", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Token dibuka blokirnya" });
    } else {
      const { error } = await supabase.from("blocked_users").insert({ token_id: t.id, reason: "Diblokir admin (replay)" });
      await supabase.from("token_sessions").delete().eq("token_id", t.id);
      if (error) { toast({ title: "Gagal blokir", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Token diblokir", description: `${t.code} tidak bisa lagi mengakses live & replay.` });
    }
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2"><Film className="h-6 w-6 text-primary" /> Manajemen Token Replay</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cari, reset perangkat, blokir, atau hapus token. Termasuk status & masa berlaku replay (14 hari setelah token live berakhir).</p>
      </div>

      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode token..." className="pl-9 font-mono" />
          </div>
          <Button type="submit" disabled={loading}>{loading ? "Memuat..." : "Cari"}</Button>
          <Button type="button" variant="outline" onClick={() => { setSearch(""); setTimeout(load, 0); }}>Reset</Button>
        </form>
      </Card>

      <div className="grid gap-3">
        {tokens.length === 0 && !loading && (
          <Card className="p-8 text-center text-sm text-muted-foreground">Tidak ada token ditemukan.</Card>
        )}
        {tokens.map((t) => {
          const blocked = blockedIds.has(t.id);
          const st = statusOf(t, blocked);
          return (
            <Card key={t.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-secondary px-2 py-0.5 text-sm font-bold text-foreground">{t.code}</code>
                    <Badge className={st.color}>{st.label}</Badge>
                    <Badge variant="outline" className="text-[10px]">{t.duration_type || "—"}</Badge>
                    {t.locked_fingerprint ? (
                      <Badge variant="outline" className="text-[10px] flex items-center gap-1"><Lock className="h-3 w-3" /> Terkunci</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] flex items-center gap-1"><Unlock className="h-3 w-3" /> Bebas</Badge>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>Dibuat: <span className="text-foreground">{fmt(t.created_at)}</span></div>
                    <div className="flex items-center gap-1"><Clock4 className="h-3 w-3" /> Live s/d: <span className="text-foreground">{fmt(t.expires_at)}</span></div>
                    <div className="flex items-center gap-1"><Film className="h-3 w-3" /> Replay s/d: <span className="text-foreground">{fmt(t.replay_expires_at)}</span></div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1"><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset token {t.code}?</AlertDialogTitle>
                        <AlertDialogDescription>Akan menghapus device-lock dan semua sesi aktif. User bisa login ulang dari perangkat baru.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleReset(t)}>Reset</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button size="sm" variant={blocked ? "default" : "secondary"} onClick={() => handleBlock(t)} className="gap-1">
                    <ShieldOff className="h-3.5 w-3.5" /> {blocked ? "Buka Blokir" : "Blokir"}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Hapus</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus token {t.code}?</AlertDialogTitle>
                        <AlertDialogDescription>Token, sesi, dan blokirnya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(t)} className="bg-destructive">Hapus</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ReplayTokenManager;
