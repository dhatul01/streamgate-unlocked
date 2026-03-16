import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const settingsKeys = [
  { key: "site_title", label: "Judul Website", placeholder: "RealTime48 Streaming", type: "input" },
  { key: "whatsapp_number", label: "Nomor WhatsApp Admin (dengan kode negara)", placeholder: "6281234567890", type: "input", hint: "Contoh: 6281234567890 (tanpa +)" },
  { key: "whatsapp_channel", label: "Link Saluran WhatsApp", placeholder: "https://whatsapp.com/channel/...", type: "input", hint: "Link saluran WhatsApp untuk info publik" },
  { key: "purchase_message", label: "Pesan untuk halaman tanpa token", placeholder: "Untuk pembelian token streaming...", type: "textarea" },
  { key: "subscription_info", label: "Informasi Langganan (tampil di menu)", placeholder: "Paket langganan kami meliputi...", type: "textarea" },
  { key: "watermark_image_url", label: "Watermark Player (URL gambar)", placeholder: "https://...", type: "input", hint: "Gambar kecil di pojok kanan bawah player. Kosongkan untuk menonaktifkan." },
];

const SiteSettingsManager = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
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
    </div>
  );
};

export default SiteSettingsManager;
