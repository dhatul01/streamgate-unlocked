import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Coins, Plus, Trash2, GripVertical, Edit2, X, Save, Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface CoinPackage {
  id: string;
  name: string;
  coin_amount: number;
  price: number;
  qris_image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const CoinPackageManager = () => {
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [editing, setEditing] = useState<CoinPackage | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPkg, setNewPkg] = useState({ name: "", coin_amount: 10, price: 25000, qris_image_url: "" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingQris, setUploadingQris] = useState(false);
  const { toast } = useToast();

  const fetchPackages = async () => {
    const { data } = await supabase.from("coin_packages").select("*").order("sort_order");
    setPackages((data as CoinPackage[]) || []);
  };

  useEffect(() => { fetchPackages(); }, []);

  const createPackage = async () => {
    if (!newPkg.name.trim()) return;
    const { error } = await supabase.from("coin_packages").insert({
      name: newPkg.name,
      coin_amount: newPkg.coin_amount,
      price: newPkg.price,
      qris_image_url: newPkg.qris_image_url || null,
      sort_order: packages.length,
    });
    if (error) {
      toast({ title: "Gagal membuat paket", description: error.message, variant: "destructive" });
      return;
    }
    setNewPkg({ name: "", coin_amount: 10, price: 25000, qris_image_url: "" });
    setShowAdd(false);
    await fetchPackages();
    toast({ title: "✅ Paket koin dibuat" });
  };

  const updatePackage = async (pkg: CoinPackage) => {
    const { error } = await supabase.from("coin_packages").update({
      name: pkg.name,
      coin_amount: pkg.coin_amount,
      price: pkg.price,
      qris_image_url: pkg.qris_image_url,
      is_active: pkg.is_active,
    }).eq("id", pkg.id);
    if (error) {
      toast({ title: "Gagal update", description: error.message, variant: "destructive" });
      return;
    }
    await fetchPackages();
    setEditing(null);
    toast({ title: "✅ Paket diperbarui" });
  };

  const deletePackage = async (id: string) => {
    setDeleting(id);
    
    // Check if there are orders referencing this package
    const { count } = await supabase
      .from("coin_orders")
      .select("id", { count: "exact", head: true })
      .eq("package_id", id);
    
    if (count && count > 0) {
      // Can't delete — deactivate instead
      const { error } = await supabase.from("coin_packages").update({ is_active: false }).eq("id", id);
      if (error) {
        toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
      } else {
        toast({ 
          title: "⚠️ Paket dinonaktifkan", 
          description: `Paket memiliki ${count} pesanan terkait sehingga tidak bisa dihapus, tapi sudah dinonaktifkan.` 
        });
        await fetchPackages();
      }
      setDeleting(null);
      return;
    }

    const { error } = await supabase.from("coin_packages").delete().eq("id", id);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "🗑️ Paket dihapus" });
      await fetchPackages();
    }
    setDeleting(null);
  };

  const toggleActive = async (pkg: CoinPackage) => {
    await supabase.from("coin_packages").update({ is_active: !pkg.is_active }).eq("id", pkg.id);
    await fetchPackages();
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "new" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File terlalu besar (max 5MB)", variant: "destructive" });
      return;
    }
    setUploadingQris(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `qris_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("show-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("show-images").getPublicUrl(path);
      const url = urlData.publicUrl;
      
      if (target === "new") {
        setNewPkg(prev => ({ ...prev, qris_image_url: url }));
      } else if (editing) {
        setEditing(prev => prev ? { ...prev, qris_image_url: url } : null);
      }
      toast({ title: "✅ QRIS diupload" });
    } catch (err: any) {
      toast({ title: "Upload gagal", description: err?.message, variant: "destructive" });
    }
    setUploadingQris(false);
  };

  const formatPrice = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">🪙 Paket Koin</h2>
        <Button onClick={() => setShowAdd(!showAdd)} variant={showAdd ? "secondary" : "default"} size="sm" className="gap-1.5">
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAdd ? "Tutup" : "Tambah Paket"}
        </Button>
      </div>

      {/* Add new */}
      {showAdd && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Tambah Paket Baru</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Nama paket" value={newPkg.name} onChange={(e) => setNewPkg({ ...newPkg, name: e.target.value })} className="bg-background" />
            <Input type="number" placeholder="Jumlah koin" value={newPkg.coin_amount} onChange={(e) => setNewPkg({ ...newPkg, coin_amount: parseInt(e.target.value) || 0 })} className="bg-background" />
            <Input type="number" placeholder="Harga (Rp)" value={newPkg.price} onChange={(e) => setNewPkg({ ...newPkg, price: parseInt(e.target.value) || 0 })} className="bg-background" />
            <div className="flex gap-2">
              <Input placeholder="URL QRIS (opsional)" value={newPkg.qris_image_url} onChange={(e) => setNewPkg({ ...newPkg, qris_image_url: e.target.value })} className="bg-background flex-1" />
              <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-secondary shrink-0">
                <Upload className="h-3 w-3" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleQrisUpload(e, "new")} />
              </label>
            </div>
          </div>
          {newPkg.qris_image_url && (
            <img src={newPkg.qris_image_url} alt="QRIS Preview" className="h-20 w-20 rounded-lg border border-border object-contain" />
          )}
          <Button onClick={createPackage} disabled={!newPkg.name.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Simpan Paket
          </Button>
        </div>
      )}

      {/* Package list */}
      <div className="space-y-2">
        {packages.map((pkg) => (
          <div key={pkg.id} className={`rounded-xl border bg-card p-3 transition-all ${
            !pkg.is_active ? "border-border opacity-60" : "border-border"
          }`}>
            {editing?.id === pkg.id ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Nama" className="bg-background" />
                  <Input type="number" value={editing.coin_amount} onChange={(e) => setEditing({ ...editing, coin_amount: parseInt(e.target.value) || 0 })} placeholder="Jumlah koin" className="bg-background" />
                  <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseInt(e.target.value) || 0 })} placeholder="Harga" className="bg-background" />
                  <div className="flex gap-2">
                    <Input value={editing.qris_image_url || ""} onChange={(e) => setEditing({ ...editing, qris_image_url: e.target.value })} placeholder="URL QRIS" className="bg-background flex-1" />
                    <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-secondary shrink-0">
                      <Upload className="h-3 w-3" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleQrisUpload(e, "edit")} />
                    </label>
                  </div>
                </div>
                {editing.qris_image_url && (
                  <img src={editing.qris_image_url} alt="QRIS" className="h-16 w-16 rounded-lg border border-border object-contain" />
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updatePackage(editing)} className="gap-1">
                    <Save className="h-3.5 w-3.5" /> Simpan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Batal</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-500 shrink-0" />
                    <span className="font-semibold text-foreground">{pkg.coin_amount} Koin</span>
                    <span className="text-xs text-muted-foreground truncate">— {pkg.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm text-primary font-medium">{formatPrice(pkg.price)}</p>
                    {pkg.qris_image_url && <span className="text-[10px] text-muted-foreground">• QRIS ✓</span>}
                  </div>
                </div>
                <Switch checked={pkg.is_active} onCheckedChange={() => toggleActive(pkg)} />
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...pkg })} className="gap-1">
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Yakin hapus paket ini?")) deletePackage(pkg.id);
                  }}
                  disabled={deleting === pkg.id}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {packages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada paket koin</p>
        )}
      </div>
    </div>
  );
};

export default CoinPackageManager;
