import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Coins, KeyRound, Loader2 } from "lucide-react";

interface Reseller {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  token_quota: number;
  total_tokens_created: number;
  is_active: boolean;
  created_at: string;
}

const ResellerManager = () => {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState<Reseller | null>(null);
  const [resetOpen, setResetOpen] = useState<Reseller | null>(null);
  const [loading, setLoading] = useState(false);

  // form states
  const [form, setForm] = useState({ email: "", password: "", username: "", full_name: "", phone: "", whatsapp: "", token_quota: "0" });
  const [topupAmount, setTopupAmount] = useState("10");
  const [topupReason, setTopupReason] = useState("");
  const [newPwd, setNewPwd] = useState("");

  const load = async () => {
    const { data } = await supabase.from("resellers").select("*").order("created_at", { ascending: false });
    setResellers((data as Reseller[]) || []);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.username) { toast.error("Email, password, username wajib"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-reseller-account", {
        body: { action: "create", ...form, token_quota: parseInt(form.token_quota) || 0 },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Reseller dibuat");
      setCreateOpen(false);
      setForm({ email: "", password: "", username: "", full_name: "", phone: "", whatsapp: "", token_quota: "0" });
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const handleDelete = async (r: Reseller) => {
    if (!confirm(`Hapus reseller ${r.username}?`)) return;
    const { data, error } = await supabase.functions.invoke("manage-reseller-account", {
      body: { action: "delete", user_id: r.user_id },
    });
    if (error || (data as { error?: string })?.error) { toast.error((data as { error: string })?.error || error?.message || "Gagal"); return; }
    toast.success("Reseller dihapus"); load();
  };

  const handleTopup = async () => {
    if (!topupOpen) return;
    const amount = parseInt(topupAmount);
    if (!amount) { toast.error("Jumlah tidak boleh 0"); return; }
    const { data, error } = await supabase.rpc("admin_topup_reseller_quota", {
      _reseller_id: topupOpen.id, _amount: amount, _reason: topupReason,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as { success: boolean; error?: string };
    if (!res.success) { toast.error(res.error || "Gagal"); return; }
    toast.success("Kuota diperbarui"); setTopupOpen(null); setTopupAmount("10"); setTopupReason(""); load();
  };

  const handleResetPwd = async () => {
    if (!resetOpen || newPwd.length < 6) { toast.error("Password min 6 karakter"); return; }
    const { data, error } = await supabase.functions.invoke("manage-reseller-account", {
      body: { action: "reset_password", user_id: resetOpen.user_id, new_password: newPwd },
    });
    if (error || (data as { error?: string })?.error) { toast.error((data as { error: string })?.error || "Gagal"); return; }
    toast.success("Password direset"); setResetOpen(null); setNewPwd("");
  };

  const toggleActive = async (r: Reseller) => {
    await supabase.from("resellers").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const filtered = resellers.filter((r) =>
    r.username.toLowerCase().includes(search.toLowerCase()) ||
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.phone.includes(search)
  );

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Manajemen Reseller</h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Reseller Baru</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Buat Reseller Baru</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>Username *</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
              <div><Label>Nama Lengkap</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>HP</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
              </div>
              <div><Label>Kuota Token Awal</Label><Input type="number" value={form.token_quota} onChange={(e) => setForm({ ...form, token_quota: e.target.value })} /></div>
              <Button onClick={handleCreate} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buat"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Cari username, nama, atau HP..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Kuota</TableHead>
              <TableHead>Total Dibuat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Belum ada reseller</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">@{r.username}</TableCell>
                <TableCell className="text-xs">{r.full_name || "-"}<br /><span className="text-muted-foreground">{r.phone}</span></TableCell>
                <TableCell><Badge variant="outline">{r.token_quota}</Badge></TableCell>
                <TableCell className="text-xs">{r.total_tokens_created}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(r)}>
                    {r.is_active ? <Badge className="bg-green-500/20 text-green-300">Aktif</Badge> : <Badge variant="secondary">Nonaktif</Badge>}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setTopupOpen(r)}><Coins className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setResetOpen(r)}><KeyRound className="h-3 w-3" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(r)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Topup dialog */}
      <Dialog open={!!topupOpen} onOpenChange={(o) => !o && setTopupOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Top-up Kuota: @{topupOpen?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Jumlah (+/-)</Label><Input type="number" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} /></div>
            <div><Label>Alasan</Label><Input value={topupReason} onChange={(e) => setTopupReason(e.target.value)} placeholder="Contoh: Pembayaran Rp 100.000" /></div>
            <Button onClick={handleTopup} className="w-full">Konfirmasi</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetOpen} onOpenChange={(o) => !o && setResetOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password: @{resetOpen?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Password Baru</Label><Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /></div>
            <Button onClick={handleResetPwd} className="w-full">Reset</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ResellerManager;
