import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Coins, Ticket, CheckCircle2, XCircle } from "lucide-react";

interface Stats {
  username: string;
  full_name: string;
  token_quota: number;
  total_tokens_created: number;
  active_tokens: number;
  expired_tokens: number;
}

const ResellerStats = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  const load = async () => {
    const { data } = await supabase.rpc("reseller_get_my_stats");
    if (data && (data as { success: boolean }).success) setStats(data as unknown as Stats);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <div className="text-muted-foreground">Memuat…</div>;

  const items = [
    { label: "Sisa Kuota Token", value: stats.token_quota, icon: Coins, color: "text-primary" },
    { label: "Total Token Dibuat", value: stats.total_tokens_created, icon: Ticket, color: "text-blue-400" },
    { label: "Token Aktif", value: stats.active_tokens, icon: CheckCircle2, color: "text-green-400" },
    { label: "Token Kadaluarsa/Blokir", value: stats.expired_tokens, icon: XCircle, color: "text-red-400" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Halo, {stats.full_name || stats.username}</h2>
        <p className="text-sm text-muted-foreground">@{stats.username}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Card key={it.label} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">{it.label}</p>
                  <p className="text-2xl font-bold">{it.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${it.color}`} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ResellerStats;
