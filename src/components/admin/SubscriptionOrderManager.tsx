import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ExternalLink, Clock, Trash2, Send, Image, SendHorizonal } from "lucide-react";
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
  status: string;
  created_at: string;
  show_title?: string;
}

const SubscriptionOrderManager = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shows, setShows] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("pending");
  const [waMessages, setWaMessages] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState("");
  const [showBulk, setShowBulk] = useState(false);
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

  const deleteOrder = async (id: string) => {
    await supabase.from("subscription_orders").delete().eq("id", id);
    await fetchOrders();
    toast({ title: "Order dihapus" });
  };

  const sendWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
  };

  const sendBulkWhatsApp = () => {
    const confirmedOrders = orders.filter((o) => o.status === "confirmed");
    confirmedOrders.forEach((order) => {
      const msg = waMessages[order.id] || bulkMessage;
      if (msg.trim()) {
        const cleanPhone = order.phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const encoded = encodeURIComponent(msg);
        window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
      }
    });
    toast({ title: `Mengirim ke ${confirmedOrders.length} user` });
    setShowBulk(false);
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const confirmedCount = orders.filter((o) => o.status === "confirmed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">📋 Order Langganan</h2>
        {confirmedCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)} className="gap-1.5">
            <SendHorizonal className="h-3.5 w-3.5" /> Kirim Massal ({confirmedCount})
          </Button>
        )}
      </div>

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
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      // Extract file path from the stored URL
                      const url = order.payment_proof_url;
                      const pathMatch = url.match(/payment-proofs\/(.+)$/);
                      if (pathMatch) {
                        const { data } = await supabase.storage
                          .from("payment-proofs")
                          .createSignedUrl(pathMatch[1], 300); // 5 min
                        if (data?.signedUrl) setPreviewImage(data.signedUrl);
                      } else {
                        setPreviewImage(url); // fallback for old URLs
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    <Image className="h-3 w-3" /> Lihat Bukti
                  </button>
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
                {order.status === "confirmed" && (
                  <div className="w-full space-y-1">
                    <Textarea
                      value={waMessages[order.id] || ""}
                      onChange={(e) => setWaMessages((prev) => ({ ...prev, [order.id]: e.target.value }))}
                      placeholder="Tulis pesan untuk user ini..."
                      className="h-16 bg-background text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-full gap-1 text-xs"
                      disabled={!waMessages[order.id]?.trim()}
                      onClick={() => sendWhatsApp(order.phone, waMessages[order.id])}
                    >
                      <Send className="h-3 w-3" /> Kirim via WA
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada order</p>}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bukti Pembayaran</DialogTitle>
            <DialogDescription>Preview bukti transfer</DialogDescription>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-3">
              <img src={previewImage} alt="Bukti Pembayaran" className="w-full rounded-lg" />
              <a
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                <ExternalLink className="h-3 w-3" /> Buka di tab baru
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Message Dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kirim Pesan Massal</DialogTitle>
            <DialogDescription>
              Pesan akan dikirim ke {confirmedCount} user yang telah dikonfirmasi via WhatsApp.
              Anda juga bisa menulis pesan berbeda per user di kartu masing-masing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              placeholder="Tulis pesan default untuk semua user..."
              className="bg-background"
              rows={4}
            />
            <p className="text-[10px] text-muted-foreground">
              * User yang sudah memiliki pesan individual akan menerima pesan tersebut, bukan pesan default.
            </p>
            <Button onClick={sendBulkWhatsApp} disabled={!bulkMessage.trim()} className="w-full gap-2">
              <SendHorizonal className="h-4 w-4" /> Kirim ke Semua ({confirmedCount})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionOrderManager;
