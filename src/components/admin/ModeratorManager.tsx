import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Shield, Eye, EyeOff } from "lucide-react";
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

const ModeratorManager = () => {
  const [moderators, setModerators] = useState<Moderator[]>([]);
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

  useEffect(() => { fetchModerators(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.username) return;
    if (form.password.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setCreating(true);

    const { data: { session } } = await supabase.auth.getSession();
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
    // Delete the moderator profile (cascade will handle token logs)
    await supabase.from("moderators").delete().eq("id", mod.id);
    // Remove role
    await supabase.from("user_roles").delete().eq("user_id", mod.user_id);
    fetchModerators();
    toast({ title: "Moderator dihapus" });
  };

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
              <p className="mt-1 text-[10px] text-muted-foreground">Akan digunakan sebagai URL: /channel/{form.username || "..."}</p>
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
          {moderators.map((mod) => (
            <div
              key={mod.id}
              className={`flex items-center justify-between rounded-xl border bg-card p-4 transition-all ${
                mod.is_active ? "border-border" : "border-destructive/30 opacity-60"
              }`}
            >
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive(mod)}
                  className="text-xs"
                >
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
          ))}
        </div>
      )}
    </div>
  );
};

export default ModeratorManager;
