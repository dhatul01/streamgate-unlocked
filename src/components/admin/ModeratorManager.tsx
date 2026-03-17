import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Shield, Eye, EyeOff, BarChart3, RotateCcw } from "lucide-react";
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

interface Moderator {
  id: string;
  user_id: string;
  username: string;
  site_name: string;
  background_color: string;
  is_active: boolean;
  created_at: string;
}

interface DurationStats {
  harian: number;
  mingguan: number;
  bulanan: number;
  lainnya: number;
}

interface TokenStats {
  [moderatorId: string]: DurationStats;
}

const EMPTY_STATS: DurationStats = { harian: 0, mingguan: 0, bulanan: 0, lainnya: 0 };

const ModeratorManager = () => {
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [tokenStats, setTokenStats] = useState<TokenStats>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", username: "", site_name: "" });
  const { toast } = useToast();

  const fetchModerators = async () => {
    const { data } = await supabase.from("moderators").select("*").order("created_at", { ascending: false });
    setModerators((data as any) || []);
    setLoading(false);
  };

  const fetchTokenStats = async () => {
    // Get logs with token duration_type
    const { data } = await supabase
      .from("moderator_token_logs")
      .select("moderator_id, tokens(duration_type)");
    
    if (data) {
      const stats: TokenStats = {};
      data.forEach((log: any) => {
        const modId = log.moderator_id;
        if (!stats[modId]) stats[modId] = { ...EMPTY_STATS };
        const durationType = (log.tokens?.duration_type || "").toLowerCase();
        // Map both English (from DB) and Indonesian labels
        if (durationType === "daily" || durationType === "harian") stats[modId].harian++;
        else if (durationType === "weekly" || durationType === "mingguan") stats[modId].mingguan++;
        else if (durationType === "monthly" || durationType === "bulanan") stats[modId].bulanan++;
        else stats[modId].lainnya++;
      });
      setTokenStats(stats);
    }
  };

  useEffect(() => {
    fetchModerators();
    fetchTokenStats();
  }, []);

  // Realtime: token logs for live stats update
  useEffect(() => {
    const channel = supabase
      .channel("admin-token-logs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moderator_token_logs" },
        () => {
          fetchTokenStats();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.username) return;
    if (form.password.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setCreating(true);

    const res = await supabase.functions.invoke("create-moderator", {
      body: {
        email: form.email,
        password: form.password,
        username: form.username.toLowerCase().replace(/[^a-z0-9-]/g, ""),
        site_name: form.site_name || "My Channel",
      },
    });

    if (res.error || res.data?.error) {
      toast({ title: "Gagal", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "Moderator berhasil dibuat!" });
      setForm({ email: "", password: "", username: "", site_name: "" });
      setShowForm(false);
      fetchModerators();
    }
    setCreating(false);
  };

  const toggleActive = async (mod: Moderator) => {
    await supabase.from("moderators").update({ is_active: !mod.is_active }).eq("id", mod.id);
    fetchModerators();
    toast({ title: mod.is_active ? "Moderator dinonaktifkan" : "Moderator diaktifkan" });
  };

  const deleteModerator = async (mod: Moderator) => {
    await supabase.from("moderators").delete().eq("id", mod.id);
    await supabase.from("user_roles").delete().eq("user_id", mod.user_id);
    fetchModerators();
    fetchTokenStats();
    toast({ title: "Moderator dihapus" });
  };

  const resetTokenStats = async (mod: Moderator) => {
    await supabase.from("moderator_token_logs").delete().eq("moderator_id", mod.id);
    fetchTokenStats();
    toast({ title: `Semua log token ${mod.username} direset` });
  };

  const resetTokenStatsByDuration = async (mod: Moderator, durationType: string) => {
    // Map Indonesian key to English DB value for filtering
    const dbDuration = durationType === "harian" ? "daily" : durationType === "mingguan" ? "weekly" : durationType === "bulanan" ? "monthly" : durationType;
    
    // Get token IDs with this duration type that belong to this moderator
    const { data: logs } = await supabase
      .from("moderator_token_logs")
      .select("id, token_id, tokens(duration_type)")
      .eq("moderator_id", mod.id);
    
    if (logs) {
      const logIdsToDelete = logs
        .filter((l: any) => {
          const dt = (l.tokens?.duration_type || "").toLowerCase();
          return dt === dbDuration || dt === durationType;
        })
        .map((l: any) => l.id);
      
      if (logIdsToDelete.length > 0) {
        await supabase.from("moderator_token_logs").delete().in("id", logIdsToDelete);
      }
    }

    fetchTokenStats();
    const label = durationType === "harian" ? "Harian" : durationType === "mingguan" ? "Mingguan" : "Bulanan";
    toast({ title: `Log token ${label} untuk ${mod.username} direset` });
  };

  const getTotal = (stats: DurationStats) => stats.harian + stats.mingguan + stats.bulanan + stats.lainnya;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">👥 Moderator Manager</h2>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          {showForm ? "Tutup" : "Tambah Moderator"}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Buat Akun Moderator</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Username (slug)</label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="nama-moderator"
                required
                className="bg-background"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">URL: /channel/{form.username || "..."}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nama Website</label>
              <Input
                value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                placeholder="My Channel"
                className="bg-background"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="moderator@email.com"
                required
                className="bg-background"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 karakter"
                  required
                  className="bg-background pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? "Membuat..." : "Buat Moderator"}
          </Button>
        </form>
      )}

      {/* Moderator List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : moderators.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada moderator. Klik "Tambah Moderator" untuk membuat.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {moderators.map((mod) => {
            const stats = tokenStats[mod.id] || { ...EMPTY_STATS };
            const total = getTotal(stats);
            return (
              <div
                key={mod.id}
                className={`rounded-xl border bg-card p-4 transition-all ${
                  mod.is_active ? "border-border" : "border-destructive/30 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: mod.background_color }}
                    >
                      {mod.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{mod.username}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          mod.is_active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                        }`}>
                          {mod.is_active ? "AKTIF" : "NONAKTIF"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{mod.site_name} · /channel/{mod.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(mod)} className="text-xs">
                      {mod.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Moderator?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Akun moderator "{mod.username}" akan dihapus permanen beserta semua log tokennya.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteModerator(mod)}>Ya, Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Token Stats by Duration */}
                <div className="mt-3 space-y-2 rounded-lg bg-secondary/30 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Total Token: {total}</span>
                    </div>
                    {total > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                            <RotateCcw className="h-3 w-3" />
                            Reset Semua
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Semua Log Token?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Semua log statistik token untuk "{mod.username}" akan direset ke 0.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => resetTokenStats(mod)}>Ya, Reset</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  {total > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: "harian", label: "Harian", color: "bg-blue-500/15 text-blue-400" },
                        { key: "mingguan", label: "Mingguan", color: "bg-amber-500/15 text-amber-400" },
                        { key: "bulanan", label: "Bulanan", color: "bg-emerald-500/15 text-emerald-400" },
                      ] as const).map(({ key, label, color }) => (
                        <div key={key} className="flex items-center justify-between rounded-md bg-background/50 px-2.5 py-2">
                          <div>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>{label}</span>
                            <span className="ml-2 text-sm font-bold text-foreground">{stats[key]}</span>
                          </div>
                          {stats[key] > 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground transition-colors">
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reset Log Token {label}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Log token {label.toLowerCase()} untuk "{mod.username}" ({stats[key]} token) akan direset.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => resetTokenStatsByDuration(mod, key)}>
                                    Ya, Reset
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {stats.lainnya > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Lainnya: {stats.lainnya}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModeratorManager;
