import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SiteSettingsManager = () => {
  const [whatsapp, setWhatsapp] = useState("");
  const [purchaseMsg, setPurchaseMsg] = useState("");
  const [siteTitle, setSiteTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("site_settings").select("*");
      if (data) {
        data.forEach((s: any) => {
          if (s.key === "whatsapp_number") setWhatsapp(s.value);
          if (s.key === "purchase_message") setPurchaseMsg(s.value);
          if (s.key === "site_title") setSiteTitle(s.value);
        });
      }
    };
    fetchSettings();
  }, []);

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    await supabase
      .from("site_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    setSaving(false);
    toast({ title: "Pengaturan disimpan" });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground">🌐 Pengaturan Website</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Judul Website</label>
        <div className="flex gap-2">
          <Input
            value={siteTitle}
            onChange={(e) => setSiteTitle(e.target.value)}
            className="bg-background"
            placeholder="RealTime48 Streaming"
          />
          <Button size="sm" onClick={() => saveSetting("site_title", siteTitle)} disabled={saving}>
            Simpan
          </Button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Nomor WhatsApp (dengan kode negara)</label>
        <div className="flex gap-2">
          <Input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="bg-background"
            placeholder="6281234567890"
          />
          <Button size="sm" onClick={() => saveSetting("whatsapp_number", whatsapp)} disabled={saving}>
            Simpan
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Contoh: 6281234567890 (tanpa +)</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Pesan untuk halaman tanpa token</label>
        <div className="flex flex-col gap-2">
          <Textarea
            value={purchaseMsg}
            onChange={(e) => setPurchaseMsg(e.target.value)}
            className="bg-background"
            rows={3}
            placeholder="Untuk pembelian token streaming..."
          />
          <Button size="sm" className="self-end" onClick={() => saveSetting("purchase_message", purchaseMsg)} disabled={saving}>
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SiteSettingsManager;
