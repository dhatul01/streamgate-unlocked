import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

interface Token {
  id: string;
  code: string;
  duration_type: string;
  expires_at: string;
  status: string;
  max_devices: number;
  locked_fingerprint: string | null;
  created_at: string;
}

const ResellerTokenList = ({ refreshKey }: { refreshKey?: number }) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tokens")
      .select("id, code, duration_type, expires_at, status, max_devices, locked_fingerprint, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setTokens((data as Token[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const filtered = tokens.filter((t) => t.code.toLowerCase().includes(search.toLowerCase()));

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/live?t=${code}`);
    toast.success("Link disalin");
  };

  const statusBadge = (t: Token) => {
    if (t.status === "blocked") return <Badge variant="destructive">Diblokir</Badge>;
    if (new Date(t.expires_at) < new Date()) return <Badge variant="secondary">Kadaluarsa</Badge>;
    return <Badge className="bg-green-500/20 text-green-300">Aktif</Badge>;
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Token Saya</h3>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <Input placeholder="Cari kode..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kadaluarsa</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Belum ada token</TableCell></TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.code}</TableCell>
                <TableCell className="text-xs capitalize">{t.duration_type}</TableCell>
                <TableCell>{statusBadge(t)}</TableCell>
                <TableCell className="text-xs">{new Date(t.expires_at).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-xs">{t.locked_fingerprint ? "1" : "0"}/{t.max_devices}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => copyLink(t.code)}><Copy className="h-3 w-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default ResellerTokenList;
