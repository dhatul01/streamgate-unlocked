import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Upload, Eye, EyeOff, Image, Crown, Lock, Unlock } from "lucide-react";

interface Show {
  id: string;
  title: string;
  price: string;
  lineup: string;
  schedule_date: string;
  schedule_time: string;
  background_image_url: string | null;
  qris_image_url: string | null;
  sort_order: number;
  is_active: boolean;
  is_subscription: boolean;
  max_subscribers: number;
  subscription_benefits: string;
  group_link: string;
  is_order_closed: boolean;
  category: string;
  category_member: string;
  coin_price: number;
}

const CATEGORY_OPTIONS = [
  { value: "regular", label: "🎭 Reguler", color: "bg-primary/10 text-primary", hasMember: false },
  { value: "birthday", label: "🎂 Ulang Tahun/STS", color: "bg-pink-500/10 text-pink-500", hasMember: true },
  { value: "special", label: "⭐ Spesial", color: "bg-yellow-500/10 text-yellow-500", hasMember: false },
  { value: "anniversary", label: "🎉 Anniversary", color: "bg-purple-500/10 text-purple-500", hasMember: false },
  { value: "last_show", label: "👋 Last Show", color: "bg-red-500/10 text-red-500", hasMember: true },
];

const ShowManager = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [editing, setEditing] = useState<Show | null>(null);
  const [uploading, setUploading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState<"bg" | "qris">("bg");
  const { toast } = useToast();

  const fetchShows = async () => {
    const { data } = await supabase.from("shows").select("*").order("sort_order");
    setShows((data as Show[]) || []);
  };

  const fetchGallery = async () => {
    const { data } = await supabase.storage.from("show-images").list("", { limit: 100 });
    if (data) {
      const urls = data
        .filter((f) => !f.name.startsWith("."))
        .map((f) => {
          const { data: urlData } = supabase.storage.from("show-images").getPublicUrl(f.name);
          return urlData.publicUrl;
        });
      setGalleryImages(urls);
    }
  };

  useEffect(() => { fetchShows(); fetchGallery(); }, []);

  const createShow = async () => {
    await supabase.from("shows").insert({
      title: "Show Baru",
      price: "Rp 0",
      lineup: "",
      schedule_date: "",
      schedule_time: "",
      sort_order: shows.length,
    });
    await fetchShows();
    toast({ title: "Show ditambahkan" });
  };

  const updateShow = async (show: Show) => {
    await supabase
      .from("shows")
      .update({
        title: show.title,
        price: show.price,
        lineup: show.lineup,
        schedule_date: show.schedule_date,
        schedule_time: show.schedule_time,
        background_image_url: show.background_image_url,
        qris_image_url: show.qris_image_url,
        is_active: show.is_active,
        sort_order: show.sort_order,
        is_subscription: show.is_subscription,
        max_subscribers: show.max_subscribers,
        subscription_benefits: show.subscription_benefits,
        group_link: show.group_link,
        is_order_closed: show.is_order_closed,
        category: show.category,
        category_member: show.category_member,
        coin_price: show.coin_price,
      })
      .eq("id", show.id);
    await fetchShows();
    toast({ title: "Show diperbarui" });
  };

  const deleteShow = async (id: string) => {
    await supabase.from("shows").delete().eq("id", id);
    await fetchShows();
    setEditing(null);
    toast({ title: "Show dihapus" });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("show-images").upload(fileName, file);
    if (error) {
      toast({ title: "Upload gagal", description: error.message, variant: "destructive" });
      setUploading(false);
      return null;
    }
    const { data: urlData } = supabase.storage.from("show-images").getPublicUrl(fileName);
    await fetchGallery();
    setUploading(false);
    return urlData.publicUrl;
  };

  const deleteGalleryImage = async (url: string) => {
    const fileName = url.split("/").pop();
    if (!fileName) return;
    await supabase.storage.from("show-images").remove([fileName]);
    await fetchGallery();
    toast({ title: "Foto dihapus" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "bg" | "qris") => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    const url = await uploadImage(file);
    if (url) {
      const updated = { ...editing, [target === "bg" ? "background_image_url" : "qris_image_url"]: url };
      setEditing(updated);
      await updateShow(updated);
    }
  };

  const selectFromGallery = async (url: string) => {
    if (!editing) return;
    const field = galleryTarget === "bg" ? "background_image_url" : "qris_image_url";
    const updated = { ...editing, [field]: url };
    setEditing(updated);
    await updateShow(updated);
    setShowGallery(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">🎭 Show Manager</h2>
        <Button onClick={createShow} size="sm"><Plus className="mr-1 h-4 w-4" /> Tambah Show</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Show list */}
        <div className="space-y-2">
          {shows.map((show) => (
            <button
              key={show.id}
              onClick={() => setEditing(show)}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                editing?.id === show.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{show.title}</p>
                  {show.is_subscription && <Crown className="h-3 w-3 text-yellow-500" />}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{show.price} · {show.schedule_date}</p>
                  {(() => {
                    const cat = CATEGORY_OPTIONS.find(c => c.value === show.category) || CATEGORY_OPTIONS[0];
                    return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cat.color}`}>{cat.label}</span>;
                  })()}
                </div>
              </div>
              {show.is_active ? <Eye className="h-4 w-4 text-success" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            </button>
          ))}
          {shows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada show</p>}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Edit Show</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => { const u = { ...editing, is_active: !editing.is_active }; setEditing(u); updateShow(u); }}
                  title={editing.is_active ? "Sembunyikan" : "Tampilkan"}>
                  {editing.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteShow(editing.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Subscription toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-foreground">Kartu Langganan</span>
              </div>
              <Switch
                checked={editing.is_subscription}
                onCheckedChange={(v) => { const u = { ...editing, is_subscription: v }; setEditing(u); updateShow(u); }}
              />
            </div>

            {/* Close orders toggle (subscription only) */}
            {editing.is_subscription && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2">
                  {editing.is_order_closed ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4 text-success" />}
                  <span className="text-sm font-medium text-foreground">Tutup Pendaftaran</span>
                </div>
                <Switch
                  checked={editing.is_order_closed}
                  onCheckedChange={(v) => { const u = { ...editing, is_order_closed: v }; setEditing(u); updateShow(u); }}
                />
              </div>
            )}

            {/* Category selector */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Kategori Show</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => { const u = { ...editing, category: cat.value }; setEditing(u); updateShow(u); }}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      (editing.category || "regular") === cat.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Member name input for birthday/last_show */}
            {(() => {
              const selectedCat = CATEGORY_OPTIONS.find(c => c.value === (editing.category || "regular"));
              return selectedCat?.hasMember ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {editing.category === "birthday" ? "Nama Member Ulang Tahun" : "Nama Member Last Show"}
                  </label>
                  <Input
                    value={editing.category_member || ""}
                    onChange={(e) => setEditing({ ...editing, category_member: e.target.value })}
                    onBlur={() => updateShow(editing)}
                    className="bg-background"
                    placeholder={editing.category === "birthday" ? "Contoh: Shani, Gracia" : "Contoh: Melody, Haruka"}
                  />
                </div>
              ) : null;
            })()}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nama Show</label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} onBlur={() => updateShow(editing)} className="bg-background" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Harga</label>
              <Input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} onBlur={() => updateShow(editing)} className="bg-background" placeholder="Rp 50.000" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Line Up Member</label>
              <Textarea value={editing.lineup} onChange={(e) => setEditing({ ...editing, lineup: e.target.value })} onBlur={() => updateShow(editing)} className="bg-background" placeholder="Member 1, Member 2..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal</label>
                <Input value={editing.schedule_date} onChange={(e) => setEditing({ ...editing, schedule_date: e.target.value })} onBlur={() => updateShow(editing)} className="bg-background" placeholder="20 Maret 2026" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Jam</label>
                <Input value={editing.schedule_time} onChange={(e) => setEditing({ ...editing, schedule_time: e.target.value })} onBlur={() => updateShow(editing)} className="bg-background" placeholder="19:00 WIB" />
              </div>
            </div>

            {/* Subscription-specific fields */}
            {editing.is_subscription && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Maks Subscriber</label>
                  <Input type="number" value={editing.max_subscribers} onChange={(e) => setEditing({ ...editing, max_subscribers: parseInt(e.target.value) || 0 })} onBlur={() => updateShow(editing)} className="bg-background" placeholder="100" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Benefit (per baris)</label>
                  <Textarea value={editing.subscription_benefits} onChange={(e) => setEditing({ ...editing, subscription_benefits: e.target.value })} onBlur={() => updateShow(editing)} className="bg-background" placeholder="Akses semua show&#10;Priority seating&#10;Merchandise exclusive" rows={4} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Link Grup</label>
                  <Input value={editing.group_link} onChange={(e) => setEditing({ ...editing, group_link: e.target.value })} onBlur={() => updateShow(editing)} className="bg-background" placeholder="https://chat.whatsapp.com/..." />
                </div>
              </>
            )}

            {/* Background image */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Foto Latar</label>
              <div className="flex gap-2">
                <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-secondary">
                  <Upload className="h-3 w-3" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "bg")} />
                </label>
                <Button variant="outline" size="sm" onClick={() => { setGalleryTarget("bg"); setShowGallery(true); }}>
                  <Image className="mr-1 h-3 w-3" /> Galeri
                </Button>
              </div>
              {editing.background_image_url && <img src={editing.background_image_url} alt="bg" className="mt-2 h-24 w-full rounded-lg object-cover" />}
            </div>

            {/* QRIS image */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Foto QRIS</label>
              <div className="flex gap-2">
                <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-secondary">
                  <Upload className="h-3 w-3" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "qris")} />
                </label>
                <Button variant="outline" size="sm" onClick={() => { setGalleryTarget("qris"); setShowGallery(true); }}>
                  <Image className="mr-1 h-3 w-3" /> Galeri
                </Button>
              </div>
              {editing.qris_image_url && <img src={editing.qris_image_url} alt="qris" className="mt-2 h-32 rounded-lg object-contain" />}
            </div>

            {uploading && <p className="text-xs text-primary">Mengupload...</p>}
          </div>
        )}
      </div>

      {/* Gallery modal */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">📸 Galeri Foto</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowGallery(false)}>Tutup</Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {galleryImages.map((url) => (
                <div key={url} className="group relative">
                  <img src={url} alt="" className="h-28 w-full cursor-pointer rounded-lg object-cover transition hover:ring-2 hover:ring-primary" onClick={() => selectFromGallery(url)} />
                  <button onClick={(e) => { e.stopPropagation(); deleteGalleryImage(url); }} className="absolute right-1 top-1 hidden rounded-full bg-destructive p-1 text-destructive-foreground group-hover:block">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {galleryImages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada foto di galeri</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowManager;
