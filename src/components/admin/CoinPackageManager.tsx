import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Coins, Plus, Trash2, GripVertical } from "lucide-react";
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
  const [newPkg, setNewPkg] = useState({ name: "", coin_amount: 10, price: 25000, qris_image_url: "" });
  const { toast } = useToast();

  const fetchPackages = async () => {
    const { data } = await supabase.from("coin_packages").select("*").order("sort_order");
    setPackages((data as CoinPackage[]) || []);
  };

  useEffect(() => { fetchPackages(); }, []);

  const createPackage = async () => {
    if (!newPkg.name.trim()) return;
    await supabase.from("coin_packages").insert({
      name: newPkg.name,
      coin_amount: newPkg.coin_amount,
      price: newPkg.price,
      qris_image_url: newPkg.qris_image_url || null,
      sort_order: packages.length,
    });
    setNewPkg({ name: "", coin_amount: 10, price: 25000, qris_image_url: "" });
    await fetchPackages();
    toast({ title: "Paket koin dibuat" });
  };

  const updatePackage = async (pkg: CoinPackage) => {
    await supabase.from("coin_packages").update({
      name: pkg.name,
      coin_amount: pkg.coin_amount,
      price: pkg.price,
      qris_image_url: pkg.qris_image_url,
      is_active: pkg.is_active,
    }).eq("id", pkg.id);
    await fetchPackages();
    setEditing(null);
    toast({ title: "Paket diperbarui" });
  };

  const deletePackage = async (id: string) => {
    await supabase.from("coin_packages").delete().eq("id", id);
    await fetchPackages();
    toast({ title: "Paket dihapus" });
  };

  const toggleActive = async (pkg: CoinPackage) => {
    await supabase.from("coin_packages").update({ is_active: !pkg.is_active }).eq("id", pkg.id);
    await fetchPackages();
  };

  const formatPrice = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">🪙 Paket Koin</h2>

      {/* Create new */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Tambah Paket Baru</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Nama paket (cth: Paket Hemat)"
            value={newPkg.name}
            onChange={(e) => setNewPkg({ ...newPkg, name: e.target.value })}
            className="bg-background"
          />
          <Input
            type="number"
            placeholder="Jumlah koin"
            value={newPkg.coin_amount}
            onChange={(e) => setNewPkg({ ...newPkg, coin_amount: parseInt(e.target.value) || 0 })}
            className="bg-background"
          />
          <Input
            type="number"
            placeholder="Harga (Rp)"
            value={newPkg.price}
            onChange={(e) => setNewPkg({ ...newPkg, price: parseInt(e.target.value) || 0 })}
            className="bg-background"
          />
          <Input
            placeholder="URL QRIS (opsional)"
            value={newPkg.qris_image_url}
            onChange={(e) => setNewPkg({ ...newPkg, qris_image_url: e.target.value })}
            className="bg-background"
          />
        </div>
        <Button onClick={createPackage} disabled={!newPkg.name.trim()} className="gap-1.5">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {packages.map((pkg) => (
          <div key={pkg.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            {editing?.id === pkg.id ? (
              <div className="flex-1 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-background" />
                  <Input type="number" value={editing.coin_amount} onChange={(e) => setEditing({ ...editing, coin_amount: parseInt(e.target.value) || 0 })} className="bg-background" />
                  <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseInt(e.target.value) || 0 })} className="bg-background" />
                  <Input value={editing.qris_image_url || ""} onChange={(e) => setEditing({ ...editing, qris_image_url: e.target.value })} placeholder="URL QRIS" className="bg-background" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updatePackage(editing)}>Simpan</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Batal</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-warning" />
                    <span className="font-semibold text-foreground">{pkg.coin_amount} Koin</span>
                    <span className="text-xs text-muted-foreground">— {pkg.name}</span>
                  </div>
                  <p className="text-sm text-primary">{formatPrice(pkg.price)}</p>
                </div>
                <Switch checked={pkg.is_active} onCheckedChange={() => toggleActive(pkg)} />
                <Button size="sm" variant="outline" onClick={() => setEditing(pkg)}>Edit</Button>
                <button onClick={() => deletePackage(pkg.id)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
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
