import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import { Crown, Sparkles, CheckCircle, Star, Upload, Users, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SharedNavbar from "@/components/viewer/SharedNavbar";

interface Show {
  id: string;
  title: string;
  price: string;
  lineup: string;
  schedule_date: string;
  schedule_time: string;
  background_image_url: string | null;
  qris_image_url: string | null;
  is_subscription: boolean;
  max_subscribers: number;
  subscription_benefits: string;
  group_link?: string;
  is_order_closed: boolean;
}

const MembershipPage = () => {
  const { toast } = useToast();
  const [shows, setShows] = useState<Show[]>([]);
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<"qris" | "upload" | "info" | "done">("qris");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const fetchData = async () => {
    const { data: allShows } = await supabase.rpc("get_public_shows");
    const data = (allShows || []).filter((s: any) => s.is_subscription);
    const subShows = (data as Show[]) || [];
    setShows(subShows);
    const counts: Record<string, number> = {};
    for (const s of subShows) {
      const { data: count } = await supabase.rpc("get_order_count", { _show_id: s.id });
      counts[s.id] = (count as number) || 0;
    }
    setSubscriberCounts(counts);
  };

  useEffect(() => {
    fetchData();

    // Realtime subscription for shows changes
    const showChannel = supabase
      .channel("membership-shows")
      .on("postgres_changes", { event: "*", schema: "public", table: "shows" }, () => fetchData())
      .subscribe();

    // Realtime subscription for order count changes
    const orderChannel = supabase
      .channel("membership-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscription_orders" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(showChannel);
      supabase.removeChannel(orderChannel);
    };
  }, []);

  const handleBuy = (show: Show) => {
    setSelectedShow(show);
    setPurchaseStep("qris");
    setProofUrl("");
    setPhone("");
    setEmail("");
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedShow) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Format file tidak didukung", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File terlalu besar (max 5MB)", variant: "destructive" });
      return;
    }
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("show_id", selectedShow.id);
      const { data, error } = await supabase.functions.invoke("upload-payment-proof", { body: formData });
      if (error) throw error;
      if (data?.path) {
        setProofUrl(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/payment-proofs/${data.path}`);
        setPurchaseStep("info");
      }
    } catch {
      toast({ title: "Upload gagal", variant: "destructive" });
    }
    setUploadingProof(false);
  };

  const handleSubmitSubscription = async () => {
    if (!selectedShow || !proofUrl) return;
    const { data: orderData } = await supabase.from("subscription_orders").insert({
      show_id: selectedShow.id,
      phone,
      email,
      payment_proof_url: proofUrl,
    }).select("id").single();
    setPurchaseStep("done");

    // Send Telegram notification
    if (orderData?.id) {
      supabase.functions.invoke("notify-subscription-order", {
        body: {
          order_id: orderData.id,
          show_title: selectedShow.title,
          phone,
          email,
          payment_proof_url: proofUrl,
        },
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedNavbar activePage="membership" />

      {/* Hero */}
      <section className="px-4 py-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Crown className="mx-auto mb-4 h-16 w-16 text-yellow-500" />
          <h1 className="text-3xl font-extrabold text-foreground md:text-5xl">
            Paket <span className="text-yellow-500">Membership</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Bergabung dengan membership untuk akses eksklusif streaming
          </p>
        </motion.div>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shows.map((show, i) => {
            const confirmed = subscriberCounts[show.id] || 0;
            const spotsLeft = show.max_subscribers > 0 ? show.max_subscribers - confirmed : null;
            const isFull = (spotsLeft !== null && spotsLeft <= 0) || show.is_order_closed;
            return (
              <motion.div
                key={show.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`group relative overflow-hidden rounded-2xl border-2 transition-all ${
                  isFull
                    ? "border-muted bg-muted/30 opacity-75"
                    : "border-yellow-500/50 bg-gradient-to-b from-yellow-500/5 to-card hover:border-yellow-500 hover:shadow-2xl hover:shadow-yellow-500/10"
                }`}
              >
                {/* Badge */}
                <div className={`absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                  isFull ? "bg-destructive text-destructive-foreground" : "bg-yellow-500 text-background"
                }`}>
                  <Sparkles className="h-3 w-3" />
                  {show.is_order_closed ? "PENDAFTARAN DITUTUP" : isFull ? "MEMBERSHIP PENUH !!!" : "MEMBERSHIP"}
                </div>

                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  {show.background_image_url ? (
                    <img src={show.background_image_url} alt={show.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-yellow-500/20 to-primary/10">
                      <Crown className="h-16 w-16 text-yellow-500/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-xl font-bold text-foreground">{show.title}</h3>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-sm font-bold text-yellow-500">{show.price}</span>
                    {spotsLeft !== null && (
                      <span className="text-xs text-muted-foreground">{confirmed}/{show.max_subscribers} terdaftar</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {show.max_subscribers > 0 && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull ? "bg-destructive" : "bg-yellow-500"
                        }`}
                        style={{ width: `${Math.min((confirmed / show.max_subscribers) * 100, 100)}%` }}
                      />
                    </div>
                  )}

                  {show.subscription_benefits && (
                    <div className="space-y-1.5">
                      {show.subscription_benefits.split("\n").filter(Boolean).map((b, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {show.schedule_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 text-yellow-500" />{show.schedule_date}
                    </div>
                  )}

                  {show.lineup && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Users className="mt-0.5 h-4 w-4 text-yellow-500" />
                      <span className="line-clamp-2">{show.lineup}</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleBuy(show)}
                    disabled={isFull}
                    className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all ${
                      isFull
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-gradient-to-r from-yellow-500 to-yellow-600 text-background hover:shadow-lg hover:shadow-yellow-500/25"
                    }`}
                  >
                    <Star className="h-4 w-4" />
                    {show.is_order_closed ? "🔒 Pendaftaran Ditutup" : isFull ? "🔒 Membership Penuh !!!" : "Berlangganan"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
        {shows.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Crown className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">Belum ada paket membership</p>
          </div>
        )}
      </section>

      {/* Purchase Modal */}
      {selectedShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6"
          >
            <h3 className="mb-1 text-lg font-bold text-foreground">{selectedShow.title}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{selectedShow.price}</p>

            {purchaseStep === "qris" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Scan QRIS untuk pembayaran:</p>
                {selectedShow.qris_image_url ? (
                  <img
                    src={selectedShow.qris_image_url}
                    alt="QRIS"
                    className="mx-auto w-full max-w-sm rounded-lg object-contain"
                  />
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground">
                    QRIS belum tersedia
                  </div>
                )}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-4 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10">
                  <Upload className="h-4 w-4" />
                  {uploadingProof ? "Mengupload..." : "Upload Bukti Pembayaran"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} />
                </label>
              </div>
            )}

            {purchaseStep === "info" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle className="h-4 w-4" /> Bukti berhasil diupload
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Nomor HP</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="bg-background" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="bg-background" />
                </div>
                <Button onClick={handleSubmitSubscription} disabled={!phone || !email} className="w-full">
                  Kirim Data Langganan
                </Button>
              </div>
            )}

            {purchaseStep === "done" && (
              <div className="space-y-4 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-yellow-500" />
                <h4 className="text-lg font-bold text-foreground">Pendaftaran Berhasil!</h4>
                <p className="text-sm text-muted-foreground">Terima kasih! Silakan bergabung ke grup membership:</p>
                {selectedShow?.group_link ? (
                  <a
                    href={selectedShow.group_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-3 font-bold text-background transition hover:shadow-lg hover:shadow-yellow-500/25"
                  >
                    <Users className="h-4 w-4" />
                    Gabung Grup Membership
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Link grup belum tersedia. Hubungi admin.</p>
                )}
              </div>
            )}

            <button onClick={() => setSelectedShow(null)}
              className="mt-4 w-full rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80">
              Tutup
            </button>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <img src={logo} alt="RealTime48" className="h-6 w-6" />
          <span className="text-sm font-semibold text-foreground">Real<span className="text-primary">Time48</span></span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Secure Streaming Platform</p>
      </footer>
    </div>
  );
};

export default MembershipPage;
