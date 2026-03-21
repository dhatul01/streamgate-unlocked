import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ExternalLink, Clock, Trash2, Image, Coins, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Order {
  id: string;
  show_id: string;
  phone: string;
  email: string;
  payment_proof_url: string;
  payment_method: string;
  status: string;
  created_at: string;
}

const SubscriptionOrderManager = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shows, setShows] = useState<Record<string, { title: string; group_link: string }>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("pending");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState("");
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data: ordersData } = await supabase
      .from("subscription_orders")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: showsData } = await supabase.from("shows").select("id, title, group_link");

    const showMap: Record<string, { title: string; group_link: string }> = {};
    showsData?.forEach((s: any) => { showMap[s.id] = { title: s.title, group_link: s.group_link || "" }; });
    setShows(showMap);
    setOrders((ordersData as Order[]) || []);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const order = orders.find((o) => o.id === id);
    await supabase.from("subscription_orders").update({ status }).eq("id", id);
    await fetchOrders();
    toast({ title: `Order ${status === "confirmed" ? "dikonfirmasi" : "ditolak"}` });
  };

  const deleteOrder = async (id: string) => {
    await supabase.from("subscription_orders").delete().eq("id", id);
    await fetchOrders();
    toast({ title: "Order dihapus" });
  };


  const copyBulkData = (field: "phone" | "email") => {
    const targetOrders = filter === "all" ? orders : orders.filter((o) => o.status === filter);
    const data = targetOrders.map((o) => field === "phone" ? o.phone : o.email).filter(Boolean).join("\n");
    navigator.clipboard.writeText(data);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
    toast({ title: `${targetOrders.length} ${field === "phone" ? "nomor HP" : "email"} disalin` });
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">📋 Order Langganan</h2>
      </div>

      <div className="flex flex-wrap gap-2">
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

      {/* Bulk copy buttons */}
      {filtered.length > 0 && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => copyBulkData("phone")} className="gap-1.5 text-xs">
            <Copy className="h-3 w-3" /> {copiedField === "phone" ? "✓ Disalin!" : `Salin Semua HP (${filtered.length})`}
          </Button>
          <Button size="sm" variant="outline" onClick={() => copyBulkData("email")} className="gap-1.5 text-xs">
            <Copy className="h-3 w-3" /> {copiedField === "email" ? "✓ Disalin!" : `Salin Semua Email (${filtered.length})`}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((order) => (
          <div key={order.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">{shows[order.show_id]?.title || "Unknown"}</p>
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
                  {order.payment_method === "coin" && (
                    <span className="flex items-center gap-1 rounded-sm bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      <Coins className="h-2.5 w-2.5" /> KOIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">📞 {order.phone} · 📧 {order.email}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleString("id-ID")}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-1">
                  {order.payment_method !== "coin" && order.payment_proof_url && (
                    <button
                      onClick={async () => {
                        const url = order.payment_proof_url;
                        const pathMatch = url.match(/payment-proofs\/(.+)$/);
                        if (pathMatch) {
                          const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(pathMatch[1], 300);
                          if (data?.signedUrl) setPreviewImage(data.signedUrl);
                        } else {
                          setPreviewImage(url);
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    >
                      <Image className="h-3 w-3" /> Lihat Bukti
                    </button>
                  )}
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
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

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bukti Pembayaran</DialogTitle>
            <DialogDescription>Preview bukti transfer</DialogDescription>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-3">
              <img src={previewImage} alt="Bukti Pembayaran" className="w-full rounded-lg" />
              <a href={previewImage} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80">
                <ExternalLink className="h-3 w-3" /> Buka di tab baru
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default SubscriptionOrderManager;
