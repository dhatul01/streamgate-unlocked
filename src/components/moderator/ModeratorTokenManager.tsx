import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  moderator: any;
}

const DURATION_OPTIONS = [
  { value: "1h", label: "1 Jam" },
  { value: "3h", label: "3 Jam" },
  { value: "6h", label: "6 Jam" },
  { value: "12h", label: "12 Jam" },
  { value: "1d", label: "1 Hari" },
  { value: "3d", label: "3 Hari" },
  { value: "7d", label: "7 Hari" },
];

const getDurationMs = (type: string) => {
  const map: Record<string, number> = {
    "1h": 3600000, "3h": 10800000, "6h": 21600000,
    "12h": 43200000, "1d": 86400000, "3d": 259200000, "7d": 604800000,
  };
  return map[type] || 86400000;
};

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const ModeratorTokenManager = ({ moderator }: Props) => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [durationType, setDurationType] = useState("1d");
  const [maxDevices, setMaxDevices] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTokens = async () => {
    // Get tokens created by this moderator via logs
    const { data: logs } = await supabase
      .from("moderator_token_logs")
      .select("token_id, tokens(*)")
      .eq("moderator_id", moderator.id)
      .order("created_at", { ascending: false });

    const tokenList = (logs || []).map((l: any) => l.tokens).filter(Boolean);
    setTokens(tokenList);
    setLoading(false);
  };

  useEffect(() => { fetchTokens(); }, [moderator.id]);

  const handleCreate = async () => {
    setCreating(true);
    const code = `${moderator.username.toUpperCase().slice(0, 4)}-${generateCode()}`;
    const expiresAt = new Date(Date.now() + getDurationMs(durationType)).toISOString();

    const { data: token, error } = await supabase.from("tokens").insert({
      code,
      duration_type: durationType,
      expires_at: expiresAt,
      max_devices: maxDevices,
      status: "active",
    }).select().single();

    if (error || !token) {
      toast({ title: "Gagal membuat token", variant: "destructive" });
      setCreating(false);
      return;
    }

    // Log the token creation
    await supabase.from("moderator_token_logs").insert({
      moderator_id: moderator.id,
      token_id: token.id,
    });

    toast({ title: "Token berhasil dibuat!" });
    fetchTokens();
    setCreating(false);
  };

  const copyLink = (code: string, id: string) => {
    const link = `${window.location.origin}/channel/${moderator.username}?token=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">🔑 Token Manager</h2>

      {/* Create Token */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Buat Token Baru</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Durasi</label>
            <Select value={durationType} onValueChange={setDurationType}>
              <SelectTrigger className="w-32 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Max Device</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxDevices}
              onChange={(e) => setMaxDevices(Number(e.target.value))}
              className="w-20 bg-background"
            />
          </div>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            <Key className="h-4 w-4" />
            {creating ? "Membuat..." : "Buat Token"}
          </Button>
        </div>
      </div>

      {/* Token List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Key className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada token yang dibuat.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => {
            const isExpired = new Date(t.expires_at) < new Date();
            const isBlocked = t.status === "blocked";
            return (
              <div key={t.id} className={`flex items-center justify-between rounded-lg border bg-card px-4 py-3 ${
                isExpired || isBlocked ? "opacity-50" : ""
              }`}>
                <div>
                  <span className="font-mono text-sm font-bold text-foreground">{t.code}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{t.duration_type} · {t.max_devices} device</span>
                    <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                      isBlocked ? "bg-destructive/15 text-destructive" :
                      isExpired ? "bg-muted text-muted-foreground" :
                      "bg-success/15 text-success"
                    }`}>
                      {isBlocked ? "BLOCKED" : isExpired ? "EXPIRED" : "ACTIVE"}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyLink(t.code, t.id)}
                  disabled={isExpired || isBlocked}
                >
                  {copiedId === t.id ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModeratorTokenManager;
