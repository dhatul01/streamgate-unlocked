import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

interface Props {
  moderator: any;
  onUpdate: (mod: any) => void;
}

const presetColors = [
  "#1a1a2e", "#16213e", "#0f3460", "#1b1b2f",
  "#2d132c", "#1a1a40", "#0d1b2a", "#1b263b",
  "#2b2d42", "#3d405b", "#0b132b", "#1c1c1c",
];

const ModeratorSiteSettings = ({ moderator, onUpdate }: Props) => {
  const [siteName, setSiteName] = useState(moderator.site_name);
  const [bgColor, setBgColor] = useState(moderator.background_color);
  const [logoUrl, setLogoUrl] = useState(moderator.logo_url || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "File harus berupa gambar", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Ukuran maksimal 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${moderator.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("moderator-logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Gagal upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("moderator-logos").getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setLogoUrl(newUrl);

    // Save to DB immediately
    await supabase.from("moderators").update({ logo_url: newUrl }).eq("id", moderator.id);
    toast({ title: "Logo berhasil diupload!" });
    setUploading(false);
  };

  const removeLogo = async () => {
    setLogoUrl("");
    await supabase.from("moderators").update({ logo_url: null }).eq("id", moderator.id);
    toast({ title: "Logo dihapus" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data, error } = await supabase
      .from("moderators")
      .update({ site_name: siteName, background_color: bgColor, logo_url: logoUrl || null })
      .eq("id", moderator.id)
      .select()
      .single();

    if (error) {
      toast({ title: "Gagal menyimpan", variant: "destructive" });
    } else {
      onUpdate(data);
      toast({ title: "Pengaturan disimpan!" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">🎨 Pengaturan Website</h2>

      <form onSubmit={handleSave} className="space-y-6 rounded-xl border border-border bg-card p-6">
        {/* Logo */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">Logo Channel</label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative">
                <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-border" />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-xs"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-5 w-5" />
              </div>
            )}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Mengupload..." : logoUrl ? "Ganti Logo" : "Upload Logo"}
              </Button>
              <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPG maks 2MB</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
        </div>

        {/* Site Name */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Nama Website</label>
          <Input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Nama channel"
            className="bg-background"
          />
        </div>

        {/* Background Color */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">Warna Background</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBgColor(color)}
                className={`h-10 w-10 rounded-lg border-2 transition-all ${
                  bgColor === color ? "border-primary scale-110" : "border-transparent hover:border-border"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border-none"
            />
            <Input
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              placeholder="#1a1a2e"
              className="w-32 bg-background font-mono text-xs"
            />
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">Preview</label>
          <div className="rounded-xl p-6 transition-all" style={{ backgroundColor: bgColor }}>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white text-sm font-bold">
                  {(siteName || "C").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-white">{siteName || "My Channel"}</h3>
                <p className="text-xs text-white/50">Preview tampilan header</p>
              </div>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-2">Info Channel</h3>
        <p className="text-xs text-muted-foreground">
          URL channel Anda: <span className="font-mono text-primary">/channel/{moderator.username}</span>
        </p>
      </div>
    </div>
  );
};

export default ModeratorSiteSettings;
