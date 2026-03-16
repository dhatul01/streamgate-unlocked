import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

const settingsKeys = [
  { key: "site_title", label: "Judul Website", placeholder: "RealTime48 Streaming", type: "input" },
  { key: "whatsapp_number", label: "Nomor WhatsApp Admin (dengan kode negara)", placeholder: "6281234567890", type: "input", hint: "Contoh: 6281234567890 (tanpa +)" },
  { key: "whatsapp_channel", label: "Link Saluran WhatsApp", placeholder: "https://whatsapp.com/channel/...", type: "input", hint: "Link saluran WhatsApp untuk info publik" },
  { key: "purchase_message", label: "Pesan untuk halaman tanpa token", placeholder: "Untuk pembelian token streaming...", type: "textarea" },
  { key: "subscription_info", label: "Informasi Langganan (tampil di menu)", placeholder: "Paket langganan kami meliputi...", type: "textarea" },
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

  const saveSetting = async (key: string) => {
    setSaving(key);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value: values[key] || "", updated_at: new Date().toISOString() }, { onConflict: "key" });
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
