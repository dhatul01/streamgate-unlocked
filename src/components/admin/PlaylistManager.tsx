import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical } from "lucide-react";

const PlaylistManager = () => {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("youtube");
  const [newUrl, setNewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchPlaylists = async () => {
    const { data } = await supabase.from("playlists").select("*").order("sort_order");
    setPlaylists(data || []);
  };

  useEffect(() => { fetchPlaylists(); }, []);

  const addPlaylist = async () => {
    if (!newLabel || !newUrl) return;
    setLoading(true);

    // Get stream id
    const { data: stream } = await supabase.from("streams").select("id").limit(1).single();

    await supabase.from("playlists").insert({
      stream_id: stream?.id,
      label: newLabel,
      type: newType,
      url: newUrl,
      sort_order: playlists.length,
    });

    setNewLabel("");
    setNewUrl("");
    await fetchPlaylists();
    toast({ title: "Playlist ditambahkan!" });
    setLoading(false);
  };

  const deletePlaylist = async (id: string) => {
    await supabase.from("playlists").delete().eq("id", id);
    await fetchPlaylists();
    toast({ title: "Playlist dihapus" });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">📋 Playlist Manager</h2>

      {/* Add new */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Tambah Sumber Video</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Server 1)"
            className="bg-background"
          />
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="m3u8">M3U8 / HLS</SelectItem>
              <SelectItem value="cloudflare">Cloudflare Stream</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="URL atau ID video"
          className="bg-background"
        />
        <Button onClick={addPlaylist} disabled={loading || !newLabel || !newUrl}>
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      </div>

      {/* Existing playlists */}
      <div className="space-y-2">
        {playlists.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{p.label}</p>
              <p className="text-xs text-muted-foreground">
                <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase">{p.type}</span>
                {" "}{p.url.length > 40 ? p.url.slice(0, 40) + "..." : p.url}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => deletePlaylist(p.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {playlists.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Belum ada playlist</p>
        )}
      </div>
    </div>
  );
};

export default PlaylistManager;
