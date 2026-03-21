import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";
import { ANIMATION_OPTIONS, type AnimationType } from "@/components/viewer/PlayerAnimations";

const settingsKeys = [
  { key: "site_title", label: "Judul Website", placeholder: "RealTime48 Streaming", type: "input" as const },
  { key: "purchase_message", label: "Pesan untuk halaman tanpa token", placeholder: "Untuk pembelian token streaming...", type: "textarea" as const },
  { key: "subscription_info", label: "Informasi Langganan (tampil di menu)", placeholder: "Paket langganan kami meliputi...", type: "textarea" as const },
  { key: "announcement_text", label: "Teks Pengumuman (tampil di landing page)", placeholder: "Pembelian membership Bulan April akan dibuka...", type: "textarea" as const, hint: "Teks pengumuman yang akan ditampilkan di landing page jika diaktifkan" },
  { key: "landing_desc_subtitle", label: "Subjudul Section Deskripsi", placeholder: "KEUNGGULAN KAMI", type: "input" as const, hint: "Teks kecil di atas judul section (opsional)" },
  { key: "landing_desc_title", label: "Judul Section Deskripsi", placeholder: "THIS IS REALTIME48 STREAM", type: "input" as const, hint: "Judul besar section deskripsi (opsional)" },
  { key: "landing_desc_quote", label: "Kutipan/Deskripsi Section", placeholder: "Membawa kemeriahan langsung di rumah Anda...", type: "textarea" as const, hint: "Teks kutipan di bawah judul section (opsional)" },
];

const WIDTH_OPTIONS = [
  { value: "narrow", label: "Sempit" },
  { value: "medium", label: "Sedang" },
  { value: "wide", label: "Lebar" },
  { value: "full", label: "Penuh" },
];

const SiteSettingsManager = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("site_settings").select("*");
      if (data) {
        const v: Record<string, string> = {};
        data.forEach((s: any) => { v[s.key] = s.value; });
        setValues(v);
      }
    };
    fetchSettings();
  }, []);

  const saveSetting = async (key: string, value?: string) => {
    setSaving(key);
    const val = value ?? values[key] ?? "";
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value: val, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(null);
    if (!error) toast({ title: "Pengaturan disimpan" });
  };

  const handleWatermarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWatermark(true);
    const ext = file.name.split(".").pop();
    const fileName = `watermark_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("show-images").upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from("show-images").getPublicUrl(fileName);
      const url = urlData.publicUrl;
      setValues((p) => ({ ...p, watermark_image_url: url }));
      await supabase
        .from("site_settings")
        .upsert({ key: "watermark_image_url", value: url, updated_at: new Date().toISOString() }, { onConflict: "key" });
      toast({ title: "Watermark diupload & disimpan" });
    }
    setUploadingWatermark(false);
  };

  const removeWatermark = async () => {
    setValues((p) => ({ ...p, watermark_image_url: "" }));
    await supabase
      .from("site_settings")
      .upsert({ key: "watermark_image_url", value: "", updated_at: new Date().toISOString() }, { onConflict: "key" });
    toast({ title: "Watermark dihapus" });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground">🌐 Pengaturan Website</h3>
      {settingsKeys.map((s) => (
        <div key={s.key}>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{s.label}</label>
          <div className={s.type === "textarea" ? "flex flex-col gap-2" : "flex gap-2"}>
            {s.type === "textarea" ? (
              <Textarea
                value={values[s.key] || ""}
                onChange={(e) => setValues((p) => ({ ...p, [s.key]: e.target.value }))}
                className="bg-background"
                rows={3}
                placeholder={s.placeholder}
              />
            ) : (
              <Input
                value={values[s.key] || ""}
                onChange={(e) => setValues((p) => ({ ...p, [s.key]: e.target.value }))}
                className="bg-background"
                placeholder={s.placeholder}
              />
            )}
            <Button
              size="sm"
              className={s.type === "textarea" ? "self-end" : ""}
              onClick={() => saveSetting(s.key)}
              disabled={saving === s.key}
            >
              Simpan
            </Button>
          </div>
          {s.hint && <p className="mt-1 text-[10px] text-muted-foreground">{s.hint}</p>}
        </div>
      ))}

      {/* Announcement toggle */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Aktifkan Pengumuman di Landing Page</label>
        <div className="flex gap-2">
          {[
            { value: "true", label: "✅ Aktif" },
            { value: "false", label: "❌ Nonaktif" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setValues((p) => ({ ...p, announcement_enabled: opt.value }));
                saveSetting("announcement_enabled", opt.value);
              }}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                (values.announcement_enabled || "false") === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Tampilkan banner pengumuman di halaman utama</p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Layout Deskripsi Landing Page</label>
        <p className="mb-2 text-[10px] text-muted-foreground">Pilih tampilan section deskripsi: daftar vertikal atau kartu grid.</p>
        <div className="flex gap-2">
          {[
            { value: "list", label: "📋 Daftar" },
            { value: "cards", label: "🃏 Kartu Grid" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setValues((p) => ({ ...p, landing_desc_layout: opt.value }));
                saveSetting("landing_desc_layout", opt.value);
              }}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                (values.landing_desc_layout || "list") === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Landing description width */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Lebar Deskripsi Landing Page</label>
        <div className="flex gap-2">
          {WIDTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setValues((p) => ({ ...p, landing_description_width: opt.value }));
                saveSetting("landing_description_width", opt.value);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                (values.landing_description_width || "medium") === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Player animation */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Animasi Player Streaming</label>
        <p className="mb-2 text-[10px] text-muted-foreground">Pilih efek animasi yang akan ditampilkan di atas video player.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ANIMATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setValues((p) => ({ ...p, player_animation: opt.value }));
                saveSetting("player_animation", opt.value);
              }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                (values.player_animation || "none") === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/30"
              }`}
            >
              <span>{opt.emoji}</span> {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Watermark upload */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Watermark Player</label>
        <p className="mb-2 text-[10px] text-muted-foreground">Gambar kecil di pojok kanan bawah player. Upload gambar untuk mengaktifkan.</p>
        {values.watermark_image_url ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <img src={values.watermark_image_url} alt="Watermark" className="h-10 w-auto rounded" />
            <span className="flex-1 truncate text-xs text-muted-foreground">Watermark aktif</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={removeWatermark}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
            <Upload className="h-4 w-4" />
            {uploadingWatermark ? "Mengupload..." : "Upload Gambar Watermark"}
            <input type="file" accept="image/*" className="hidden" onChange={handleWatermarkUpload} disabled={uploadingWatermark} />
          </label>
        )}
      </div>
    </div>
  );
};

export default SiteSettingsManager;
