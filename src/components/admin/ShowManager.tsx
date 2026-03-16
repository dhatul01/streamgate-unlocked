import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Upload, Eye, EyeOff, Image } from "lucide-react";

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
}

const ShowManager = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [editing, setEditing] = useState<Show | null>(null);
  const [uploading, setUploading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState<"bg" | "qris">("bg");
  const { toast } = useToast();

  const fetchShows = async () => {
    const { data } = await supabase
      .from("shows")
      .select("*")
      .order("sort_order");
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

  useEffect(() => {
    fetchShows();
    fetchGallery();
  }, []);

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
    const { error } = await supabase.storage
      .from("show-images")
      .upload(fileName, file);
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
        <Button onClick={createShow} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Tambah Show
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Show list */}
        <div className="space-y-2">
          {shows.map((show) => (
            <button
              key={show.id}
              onClick={() => setEditing(show)}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                editing?.id === show.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{show.title}</p>
                <p className="text-xs text-muted-foreground">{show.price} · {show.schedule_date}</p>
              </div>
              {show.is_active ? (
                <Eye className="h-4 w-4 text-success" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}
          {shows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada show</p>
          )}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Edit Show</h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const updated = { ...editing, is_active: !editing.is_active };
                    setEditing(updated);
                    updateShow(updated);
                  }}
                  title={editing.is_active ? "Sembunyikan" : "Tampilkan"}
                >
                  {editing.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteShow(editing.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nama Show</label>
              <Input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                onBlur={() => updateShow(editing)}
                className="bg-background"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Harga</label>
              <Input
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                onBlur={() => updateShow(editing)}
                className="bg-background"
                placeholder="Rp 50.000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Line Up Member</label>
              <Textarea
                value={editing.lineup}
                onChange={(e) => setEditing({ ...editing, lineup: e.target.value })}
                onBlur={() => updateShow(editing)}
                className="bg-background"
                placeholder="Member 1, Member 2, Member 3..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal</label>
                <Input
                  value={editing.schedule_date}
                  onChange={(e) => setEditing({ ...editing, schedule_date: e.target.value })}
                  onBlur={() => updateShow(editing)}
                  className="bg-background"
                  placeholder="20 Maret 2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Jam</label>
                <Input
                  value={editing.schedule_time}
                  onChange={(e) => setEditing({ ...editing, schedule_time: e.target.value })}
                  onBlur={() => updateShow(editing)}
                  className="bg-background"
                  placeholder="19:00 WIB"
                />
              </div>
            </div>

            {/* Background image */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Foto Latar</label>
              <div className="flex gap-2">
                <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-secondary">
                  <Upload className="h-3 w-3" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "bg")} />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setGalleryTarget("bg"); setShowGallery(true); }}
                >
                  <Image className="mr-1 h-3 w-3" /> Galeri
                </Button>
              </div>
              {editing.background_image_url && (
                <img src={editing.background_image_url} alt="bg" className="mt-2 h-24 w-full rounded-lg object-cover" />
              )}
            </div>

            {/* QRIS image */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Foto QRIS</label>
              <div className="flex gap-2">
                <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-secondary">
                  <Upload className="h-3 w-3" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "qris")} />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setGalleryTarget("qris"); setShowGallery(true); }}
                >
                  <Image className="mr-1 h-3 w-3" /> Galeri
                </Button>
              </div>
              {editing.qris_image_url && (
                <img src={editing.qris_image_url} alt="qris" className="mt-2 h-32 rounded-lg object-contain" />
              )}
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
                  <img
                    src={url}
                    alt=""
                    className="h-28 w-full cursor-pointer rounded-lg object-cover transition hover:ring-2 hover:ring-primary"
                    onClick={() => selectFromGallery(url)}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteGalleryImage(url); }}
                    className="absolute right-1 top-1 hidden rounded-full bg-destructive p-1 text-destructive-foreground group-hover:block"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {galleryImages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Belum ada foto di galeri</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowManager;
