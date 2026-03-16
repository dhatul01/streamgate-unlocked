import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ExternalLink, Clock } from "lucide-react";

interface Order {
  id: string;
  show_id: string;
  phone: string;
  email: string;
  payment_proof_url: string;
  status: string;
  created_at: string;
  show_title?: string;
}

const SubscriptionOrderManager = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shows, setShows] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("pending");
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data: ordersData } = await supabase
      .from("subscription_orders")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: showsData } = await supabase.from("shows").select("id, title");
    
    const showMap: Record<string, string> = {};
    showsData?.forEach((s: any) => { showMap[s.id] = s.title; });
    setShows(showMap);
    setOrders((ordersData as Order[]) || []);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("subscription_orders").update({ status }).eq("id", id);
    await fetchOrders();
    toast({ title: `Order ${status === "confirmed" ? "dikonfirmasi" : "ditolak"}` });
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">📋 Order Langganan</h2>

      <div className="flex gap-2">
        {(["pending", "confirmed", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {f === "pending" ? "Menunggu" : f === "confirmed" ? "Dikonfirmasi" : f === "rejected" ? "Ditolak" : "Semua"}
            {f !== "all" && ` (${orders.filter((o) => o.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((order) => (
          <div key={order.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{shows[order.show_id] || "Unknown"}</p>
                  <span className={`flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                    order.status === "pending" ? "bg-warning/20 text-warning"
                    : order.status === "confirmed" ? "bg-success/20 text-success"
                    : "bg-destructive/20 text-destructive"
                  }`}>
                    {order.status === "pending" ? <Clock className="h-2.5 w-2.5" /> 
                    : order.status === "confirmed" ? <CheckCircle className="h-2.5 w-2.5" /> 
                    : <XCircle className="h-2.5 w-2.5" />}
                    {order.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">📞 {order.phone} · 📧 {order.email}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleString("id-ID")}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <a
                  href={order.payment_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                >
                  <ExternalLink className="h-3 w-3" /> Bukti
                </a>
                {order.status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" onClick={() => updateStatus(order.id, "confirmed")} className="h-7 text-xs">
                      <CheckCircle className="mr-1 h-3 w-3" /> Konfirmasi
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(order.id, "rejected")} className="h-7 text-xs">
                      <XCircle className="mr-1 h-3 w-3" /> Tolak
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada order</p>}
      </div>
    </div>
  );
};

export default SubscriptionOrderManager;
