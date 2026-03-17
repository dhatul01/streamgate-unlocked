import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data, error } = await supabase
      .from("moderators")
      .update({ site_name: siteName, background_color: bgColor })
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
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Nama Website</label>
          <Input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Nama channel"
            className="bg-background"
          />
        </div>

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
          <div
            className="rounded-xl p-6 text-center transition-all"
            style={{ backgroundColor: bgColor }}
          >
            <h3 className="text-lg font-bold text-white">{siteName || "My Channel"}</h3>
            <p className="mt-1 text-sm text-white/60">Preview tampilan website cabang</p>
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
