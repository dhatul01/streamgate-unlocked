import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Log {
  id: string;
  reseller_id: string;
  action: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}
interface Reseller { id: string; username: string }

const ResellerAuditView = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [resellers, setResellers] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: lg }, { data: rs }] = await Promise.all([
        supabase.from("reseller_audit_logs").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("resellers").select("id, username"),
      ]);
      setLogs((lg as Log[]) || []);
      const map: Record<string, string> = {};
      ((rs as Reseller[]) || []).forEach((r) => { map[r.id] = r.username; });
      setResellers(map);
    })();
  }, []);

  const filtered = logs.filter((l) => {
    const u = resellers[l.reseller_id] || "";
    return u.toLowerCase().includes(search.toLowerCase()) || l.action.includes(search.toLowerCase());
  });

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-4 text-xl font-bold">Audit Log Reseller</h2>
      <Input placeholder="Cari username atau aksi..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Reseller</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Belum ada log</TableCell></TableRow>}
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("id-ID")}</TableCell>
                <TableCell className="font-mono text-xs">@{resellers[l.reseller_id] || "?"}</TableCell>
                <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{JSON.stringify(l.metadata)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default ResellerAuditView;
