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
  const [nextShowTime, setNextShowTime] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const [streamRes, settingsRes] = await Promise.all([
        supabase.from("streams").select("*").limit(1).single(),
        supabase.from("site_settings").select("*"),
      ]);
      if (streamRes.data) {
        setStream(streamRes.data);
        setTitle(streamRes.data.title);
        setDescription(streamRes.data.description || "");
        setIsLive(streamRes.data.is_live);
      }
      if (settingsRes.data) {
        settingsRes.data.forEach((s: any) => {
          if (s.key === "next_show_time") setNextShowTime(s.value);
        });
      }
    };
    fetchData();
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

  const saveNextShowTime = async () => {
    await supabase
      .from("site_settings")
      .upsert({ key: "next_show_time", value: nextShowTime, updated_at: new Date().toISOString() }, { onConflict: "key" });
    toast({ title: "Jadwal show disimpan!" });
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

      {/* Next Show Countdown */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">⏰ Jadwal Show Berikutnya</h3>
        <p className="text-xs text-muted-foreground">Countdown akan tampil di player saat offline. Format: YYYY-MM-DDTHH:mm (contoh: 2026-03-16T20:00)</p>
        <div className="flex gap-2">
          <Input
            type="datetime-local"
            value={nextShowTime}
            onChange={(e) => setNextShowTime(e.target.value)}
            className="bg-background"
          />
          <Button onClick={saveNextShowTime} size="sm">Simpan</Button>
        </div>
        {nextShowTime && (
          <p className="text-xs text-muted-foreground">
            Dijadwalkan: {new Date(nextShowTime).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}
          </p>
        )}
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
