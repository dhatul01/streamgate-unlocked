import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

interface Props { onCreated?: () => void }

const ResellerTokenCreator = ({ onCreated }: Props) => {
  const [code, setCode] = useState("");
  const [duration, setDuration] = useState<"daily" | "weekly" | "monthly">("daily");
  const [maxDevices, setMaxDevices] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const computeExpiry = () => {
    const d = new Date();
    if (duration === "daily") d.setDate(d.getDate() + 1);
    if (duration === "weekly") d.setDate(d.getDate() + 7);
    if (duration === "monthly") d.setDate(d.getDate() + 30);
    return d.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCreatedCode(null);
    try {
      const { data, error } = await supabase.rpc("reseller_create_token", {
        _code: code.trim(),
        _duration_type: duration,
        _expires_at: computeExpiry(),
        _max_devices: maxDevices,
      });
      if (error) throw error;
      const res = data as { success: boolean; error?: string; code?: string };
      if (!res.success) throw new Error(res.error || "Gagal");
      setCreatedCode(res.code!);
      setCode("");
      toast.success(`Token ${res.code} berhasil dibuat`);
      onCreated?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!createdCode) return;
    const link = `${window.location.origin}/live?t=${createdCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Link disalin");
  };

  return (
    <Card className="p-4 sm:p-6">
      <h3 className="mb-4 text-lg font-semibold">Buat Token Baru</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Kode Token (opsional, kosongkan untuk auto)</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="RSL-XXXXXXXX" maxLength={32} />
        </div>
        <div>
          <Label>Durasi</Label>
          <Select value={duration} onValueChange={(v) => setDuration(v as typeof duration)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Harian (1 hari)</SelectItem>
              <SelectItem value="weekly">Mingguan (7 hari)</SelectItem>
              <SelectItem value="monthly">Bulanan (30 hari)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Max Perangkat</Label>
          <Input type="number" min={1} max={5} value={maxDevices} onChange={(e) => setMaxDevices(parseInt(e.target.value) || 1)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buat Token (–1 kuota)"}
          </Button>
        </div>
      </form>
      {createdCode && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Token baru:</p>
            <p className="truncate font-mono font-bold">{createdCode}</p>
          </div>
          <Button size="sm" variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
        </div>
      )}
    </Card>
  );
};

export default ResellerTokenCreator;
