import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const LiveControl = () => {
  const [stream, setStream] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStream = async () => {
      const { data } = await supabase.from("streams").select("*").limit(1).single();
      if (data) {
        setStream(data);
        setTitle(data.title);
        setDescription(data.description || "");
        setIsLive(data.is_live);
      }
    };
    fetchStream();
  }, []);

  const toggleLive = async (checked: boolean) => {
    if (!stream) return;
    setIsLive(checked);
    await supabase.from("streams").update({ is_live: checked }).eq("id", stream.id);
    toast({ title: checked ? "🔴 Live ON" : "⚫ Live OFF" });
  };

  const saveDetails = async () => {
    if (!stream) return;
    setSaving(true);
    await supabase.from("streams").update({ title, description }).eq("id", stream.id);
    toast({ title: "Tersimpan!" });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">🔴 Live Control</h2>

      {/* Live Toggle */}
      <div className={`flex items-center justify-between rounded-xl border p-6 ${isLive ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
        <div>
          <p className="text-lg font-bold text-foreground">{isLive ? "LIVE" : "OFFLINE"}</p>
          <p className="text-sm text-muted-foreground">Toggle status live stream</p>
        </div>
        <div className={`${isLive ? "animate-glow-pulse" : ""}`}>
          <Switch checked={isLive} onCheckedChange={toggleLive} />
        </div>
      </div>

      {/* Stream Details */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Judul Live</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Deskripsi</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background" />
        </div>
        <Button onClick={saveDetails} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </div>
  );
};

export default LiveControl;
