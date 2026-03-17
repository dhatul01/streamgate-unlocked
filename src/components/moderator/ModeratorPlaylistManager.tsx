import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";

interface Props {
  moderator: any;
}

const TYPES = [
  { value: "m3u8", label: "HLS (m3u8)" },
  { value: "youtube", label: "YouTube" },
  { value: "cloudflare", label: "Cloudflare" },
];

interface PlaylistItem {
  id?: string;
  label: string;
  type: string;
  url: string;
  sort_order: number;
  isNew?: boolean;
}

const ModeratorPlaylistManager = ({ moderator }: Props) => {
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPlaylists();
  }, [moderator.id]);

  const fetchPlaylists = async () => {
    const { data, error } = await supabase
      .from("moderator_playlists")
      .select("*")
      .eq("moderator_id", moderator.id)
      .order("sort_order");

    if (error) {
      toast({ title: "Gagal memuat playlist", variant: "destructive" });
    } else {
      setPlaylists(data || []);
    }
    setLoading(false);
  };

  const addPlaylist = () => {
    setPlaylists((prev) => [
      ...prev,
      {
        label: `Sumber ${prev.length + 1}`,
        type: "m3u8",
        url: "",
        sort_order: prev.length,
        isNew: true,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof PlaylistItem, value: string | number) => {
    setPlaylists((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const removeItem = async (index: number) => {
    const item = playlists[index];
    if (item.id) {
      const { error } = await supabase.from("moderator_playlists").delete().eq("id", item.id);
      if (error) {
        toast({ title: "Gagal menghapus", variant: "destructive" });
        return;
      }
    }
    setPlaylists((prev) => prev.filter((_, i) => i !== index));
    toast({ title: "Playlist dihapus" });
  };

  const saveAll = async () => {
    setSaving(true);

    for (let i = 0; i < playlists.length; i++) {
      const item = playlists[i];
      if (!item.url.trim() || !item.label.trim()) {
        toast({ title: `Item ${i + 1}: Label dan URL wajib diisi`, variant: "destructive" });
        setSaving(false);
        return;
      }

      const payload = {
        moderator_id: moderator.id,
        label: item.label.trim(),
        type: item.type,
        url: item.url.trim(),
        sort_order: i,
      };

      if (item.id && !item.isNew) {
        const { error } = await supabase
          .from("moderator_playlists")
          .update(payload)
          .eq("id", item.id);
        if (error) {
          toast({ title: `Gagal update ${item.label}`, variant: "destructive" });
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase.from("moderator_playlists").insert(payload);
        if (error) {
          toast({ title: `Gagal simpan ${item.label}`, variant: "destructive" });
          setSaving(false);
          return;
        }
      }
    }

    toast({ title: "Semua playlist tersimpan!" });
    await fetchPlaylists();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">🎬 Playlist Saya</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Kelola sumber video untuk website channel Anda
          </p>
        </div>
        <Button onClick={addPlaylist} size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      {playlists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-3xl mb-2">📺</p>
          <p className="text-sm text-muted-foreground">Belum ada playlist. Tambahkan sumber video pertama Anda!</p>
          <Button onClick={addPlaylist} size="sm" className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> Tambah Playlist
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {playlists.map((item, index) => (
            <div
              key={item.id || `new-${index}`}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-bold text-muted-foreground shrink-0">#{index + 1}</span>
                <Input
                  value={item.label}
                  onChange={(e) => updateItem(index, "label", e.target.value)}
                  placeholder="Label sumber"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <select
                  value={item.type}
                  onChange={(e) => updateItem(index, "type", e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <Input
                  value={item.url}
                  onChange={(e) => updateItem(index, "url", e.target.value)}
                  placeholder={
                    item.type === "youtube"
                      ? "https://youtube.com/watch?v=..."
                      : item.type === "cloudflare"
                      ? "Cloudflare Stream ID"
                      : "https://example.com/stream.m3u8"
                  }
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {playlists.length > 0 && (
        <Button onClick={saveAll} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Menyimpan..." : "Simpan Semua Playlist"}
        </Button>
      )}
    </div>
  );
};

export default ModeratorPlaylistManager;
