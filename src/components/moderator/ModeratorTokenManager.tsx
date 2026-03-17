import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Check, ShieldBan, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  moderator: any;
}

const DURATION_OPTIONS = [
  { value: "daily", label: "Harian (1 Hari)", ms: 86400000 },
  { value: "weekly", label: "Mingguan (7 Hari)", ms: 604800000 },
  { value: "monthly", label: "Bulanan (30 Hari)", ms: 2592000000 },
];

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
  const [durationType, setDurationType] = useState("daily");
  const [maxDevices, setMaxDevices] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTokens = async () => {
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
    const durationOption = DURATION_OPTIONS.find(d => d.value === durationType)!;
    const code = `${moderator.username.toUpperCase().slice(0, 4)}-${generateCode()}`;
    const expiresAt = new Date(Date.now() + durationOption.ms).toISOString();

    const { data, error } = await supabase.rpc("moderator_create_token", {
      _code: code,
      _duration_type: durationType,
      _expires_at: expiresAt,
      _max_devices: maxDevices,
    });

    const result = data as any;
    if (error || !result?.success) {
      toast({ title: "Gagal membuat token", description: error?.message || result?.error, variant: "destructive" });
      setCreating(false);
      return;
    }

    toast({ title: "Token berhasil dibuat!" });
    fetchTokens();
    setCreating(false);
  };

  const toggleBlock = async (token: any) => {
    const newStatus = token.status === "blocked" ? "active" : "blocked";
    await supabase.from("tokens").update({ status: newStatus }).eq("id", token.id);
    toast({ title: newStatus === "blocked" ? "Token diblokir" : "Token dibuka blokir" });
    fetchTokens();
  };

  const copyLink = (code: string, id: string) => {
    const link = `${window.location.origin}/channel/${moderator.username}?token=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDurationLabel = (type: string) => {
    const opt = DURATION_OPTIONS.find(d => d.value === type);
    return opt ? opt.label : type;
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
              <SelectTrigger className="w-44 bg-background">
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
                isExpired || isBlocked ? "opacity-60" : ""
              }`}>
                <div>
                  <span className="font-mono text-sm font-bold text-foreground">{t.code}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{getDurationLabel(t.duration_type)} · {t.max_devices} device</span>
                    <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                      isBlocked ? "bg-destructive/15 text-destructive" :
                      isExpired ? "bg-muted text-muted-foreground" :
                      "bg-success/15 text-success"
                    }`}>
                      {isBlocked ? "BLOCKED" : isExpired ? "EXPIRED" : "ACTIVE"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!isExpired && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className={isBlocked ? "text-success hover:bg-success/10" : "text-destructive hover:bg-destructive/10"}>
                          {isBlocked ? <ShieldCheck className="h-4 w-4" /> : <ShieldBan className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{isBlocked ? "Buka Blokir Token?" : "Blokir Token?"}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {isBlocked
                              ? `Token "${t.code}" akan dibuka blokirnya dan bisa digunakan kembali.`
                              : `Token "${t.code}" akan diblokir dan tidak bisa digunakan.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => toggleBlock(t)}>
                            {isBlocked ? "Ya, Buka Blokir" : "Ya, Blokir"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyLink(t.code, t.id)}
                    disabled={isExpired || isBlocked}
                  >
                    {copiedId === t.id ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModeratorTokenManager;
