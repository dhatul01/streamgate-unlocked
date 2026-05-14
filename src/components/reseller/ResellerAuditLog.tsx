import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Log {
  id: string;
  action: string;
  target_token_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ResellerAuditLog = () => {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    supabase
      .from("reseller_audit_logs")
      .select("id, action, target_token_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setLogs((data as Log[]) || []));
  }, []);

  return (
    <Card className="p-4 sm:p-6">
      <h3 className="mb-4 text-lg font-semibold">Audit Log Aktivitas Saya</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Belum ada log</TableCell></TableRow>
            )}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("id-ID")}</TableCell>
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

export default ResellerAuditLog;
