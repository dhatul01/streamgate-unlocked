import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Coins, KeyRound, Loader2, Phone } from "lucide-react";

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
  prefix: string;
  bot_enabled: boolean;
  created_at: string;
}

interface ResellerPhone {
  id: string;
  phone: string;
  label: string;
}

const ResellerManager = () => {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState<Reseller | null>(null);
  const [resetOpen, setResetOpen] = useState<Reseller | null>(null);
  const [phonesOpen, setPhonesOpen] = useState<Reseller | null>(null);
  const [phones, setPhones] = useState<ResellerPhone[]>([]);
  const [newPhone, setNewPhone] = useState({ phone: "", label: "" });
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ email: "", password: "", username: "", full_name: "", phone: "", whatsapp: "", token_quota: "0", prefix: "" });
  const [topupAmount, setTopupAmount] = useState("10");
  const [topupReason, setTopupReason] = useState("");
  const [newPwd, setNewPwd] = useState("");

  const load = async () => {
    const { data } = await supabase.from("resellers").select("*").order("created_at", { ascending: false });
    setResellers((data as Reseller[]) || []);
  };
  useEffect(() => { load(); }, []);

  const loadPhones = async (resellerId: string) => {
    const { data } = await supabase.from("reseller_phones").select("*").eq("reseller_id", resellerId).order("created_at");
    setPhones((data as ResellerPhone[]) || []);
  };

  const openPhones = async (r: Reseller) => {
    setPhonesOpen(r);
    await loadPhones(r.id);
  };

  const handleAddPhone = async () => {
    if (!phonesOpen) return;
    const phone = newPhone.phone.replace(/[^0-9]/g, "");
    if (phone.length < 10) { toast.error("Nomor minimal 10 digit"); return; }
    const { error } = await supabase.from("reseller_phones").insert({ reseller_id: phonesOpen.id, phone, label: newPhone.label || "Utama" });
    if (error) { toast.error(error.message); return; }
    setNewPhone({ phone: "", label: "" });
    loadPhones(phonesOpen.id);
    toast.success("Nomor ditambahkan");
  };

  const handleDeletePhone = async (id: string) => {
    if (!phonesOpen) return;
    await supabase.from("reseller_phones").delete().eq("id", id);
    loadPhones(phonesOpen.id);
  };

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.username) { toast.error("Email, password, username wajib"); return; }
    if (form.prefix && !/^[A-Z0-9]{2,8}$/.test(form.prefix.toUpperCase())) {
      toast.error("Prefix 2-8 huruf/angka"); return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-reseller-account", {
        body: { action: "create", ...form, prefix: form.prefix.toUpperCase() || undefined, token_quota: parseInt(form.token_quota) || 0 },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const newId = (data as { reseller_id?: string })?.reseller_id;
      if (form.prefix && newId) {
        await supabase.from("resellers").update({ prefix: form.prefix.toUpperCase() }).eq("id", newId);
      }
      toast.success("Reseller dibuat");
      setCreateOpen(false);
      setForm({ email: "", password: "", username: "", full_name: "", phone: "", whatsapp: "", token_quota: "0", prefix: "" });
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
    const { data, error } = await supabase.rpc("admin_topup_reseller_quota", { _reseller_id: topupOpen.id, _amount: amount, _reason: topupReason });
    if (error) { toast.error(error.message); return; }
    const res = data as { success: boolean; error?: string };
    if (!res.success) { toast.error(res.error || "Gagal"); return; }
    toast.success("Kuota diperbarui"); setTopupOpen(null); setTopupAmount("10"); setTopupReason(""); load();
  };

  const handleResetPwd = async () => {
    if (!resetOpen || newPwd.length < 6) { toast.error("Password min 6"); return; }
    const { data, error } = await supabase.functions.invoke("manage-reseller-account", {
      body: { action: "reset_password", user_id: resetOpen.user_id, new_password: newPwd },
    });
    if (error || (data as { error?: string })?.error) { toast.error((data as { error: string })?.error || "Gagal"); return; }
    toast.success("Password direset"); setResetOpen(null); setNewPwd("");
  };

  const updatePrefix = async (r: Reseller, prefix: string) => {
    const up = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (up.length < 2) { toast.error("Prefix 2-8 huruf/angka"); return; }
    const { error } = await supabase.from("resellers").update({ prefix: up }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Prefix diperbarui");
    load();
  };

  const toggleBot = async (r: Reseller) => {
    await supabase.from("resellers").update({ bot_enabled: !r.bot_enabled }).eq("id", r.id);
    load();
  };

  const toggleActive = async (r: Reseller) => {
    await supabase.from("resellers").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const filtered = resellers.filter((r) =>
    r.username.toLowerCase().includes(search.toLowerCase()) ||
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.prefix || "").toLowerCase().includes(search.toLowerCase()) ||
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
              <div><Label>Prefix Token (2-8 huruf/angka)</Label>
                <Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) })} placeholder="AGUS" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>HP</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
              </div>
              <div><Label>Kuota Awal</Label><Input type="number" value={form.token_quota} onChange={(e) => setForm({ ...form, token_quota: e.target.value })} /></div>
              <Button onClick={handleCreate} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buat"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Cari username, prefix, nama, atau HP..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Bot</TableHead>
              <TableHead>Kuota</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Belum ada reseller</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">@{r.username}<br /><span className="text-muted-foreground">{r.full_name || "-"}</span></TableCell>
                <TableCell>
                  <Input
                    defaultValue={r.prefix}
                    className="h-7 w-20 font-mono text-xs uppercase"
                    onBlur={(e) => { if (e.target.value.toUpperCase() !== r.prefix) updatePrefix(r, e.target.value); }}
                  />
                </TableCell>
                <TableCell><Switch checked={r.bot_enabled} onCheckedChange={() => toggleBot(r)} /></TableCell>
                <TableCell><Badge variant="outline">{r.token_quota}</Badge></TableCell>
                <TableCell className="text-xs">{r.total_tokens_created}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(r)}>
                    {r.is_active ? <Badge className="bg-green-500/20 text-green-300">Aktif</Badge> : <Badge variant="secondary">Off</Badge>}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" title="Nomor Bot" onClick={() => openPhones(r)}><Phone className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" title="Top-up" onClick={() => setTopupOpen(r)}><Coins className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" title="Reset Password" onClick={() => setResetOpen(r)}><KeyRound className="h-3 w-3" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(r)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phones dialog */}
      <Dialog open={!!phonesOpen} onOpenChange={(o) => !o && setPhonesOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nomor WhatsApp Bot: @{phonesOpen?.username}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Reseller bisa kirim perintah ke bot dari nomor-nomor ini.</p>
          <div className="space-y-2">
            {phones.length === 0 && <p className="text-xs text-muted-foreground">Belum ada nomor.</p>}
            {phones.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-border p-2">
                <div className="text-sm"><span className="font-mono">{p.phone}</span> <span className="text-xs text-muted-foreground">({p.label})</span></div>
                <Button size="sm" variant="ghost" onClick={() => handleDeletePhone(p.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
            <Input className="col-span-2" placeholder="62812..." value={newPhone.phone} onChange={(e) => setNewPhone({ ...newPhone, phone: e.target.value })} />
            <Input placeholder="Label" value={newPhone.label} onChange={(e) => setNewPhone({ ...newPhone, label: e.target.value })} />
            <Button onClick={handleAddPhone} className="col-span-3"><Plus className="h-3 w-3 mr-1" />Tambah Nomor</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!topupOpen} onOpenChange={(o) => !o && setTopupOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Top-up Kuota: @{topupOpen?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Jumlah (+/-)</Label><Input type="number" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} /></div>
            <div><Label>Alasan</Label><Input value={topupReason} onChange={(e) => setTopupReason(e.target.value)} /></div>
            <Button onClick={handleTopup} className="w-full">Konfirmasi</Button>
          </div>
        </DialogContent>
      </Dialog>

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
