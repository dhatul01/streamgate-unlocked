import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";
import heroBg from "@/assets/hero-bg.jpg";
import { Calendar, Clock, Users, MessageCircle, Ticket, Star, Upload, CheckCircle, Crown, Sparkles, Menu, X, Phone, Info, Radio, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  group_link: string;
}

interface LandingDescription {
  id: string;
  title: string;
  content: string;
  icon: string;
}

interface SiteSettings {
  whatsapp_number: string;
  purchase_message: string;
  site_title: string;
  whatsapp_channel: string;
  subscription_info: string;
}

const Index = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [descriptions, setDescriptions] = useState<LandingDescription[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({
    whatsapp_number: "",
    purchase_message: "",
    site_title: "RealTime48 Streaming",
    whatsapp_channel: "",
    subscription_info: "",
  });
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<"qris" | "upload" | "info" | "done">("qris");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      const [showsRes, settingsRes, descRes] = await Promise.all([
        supabase.from("shows").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("site_settings").select("*"),
        supabase.from("landing_descriptions").select("*").eq("is_active", true).order("sort_order"),
      ]);
      if (showsRes.data) {
        setShows(showsRes.data as Show[]);
        const subShows = (showsRes.data as Show[]).filter((s) => s.is_subscription);
        if (subShows.length > 0) {
          const counts: Record<string, number> = {};
          for (const s of subShows) {
            const { data: count } = await supabase.rpc("get_confirmed_order_count", { _show_id: s.id });
            counts[s.id] = (count as number) || 0;
          }
          setSubscriberCounts(counts);
        }
      }
      if (settingsRes.data) {
        const s: any = {};
        settingsRes.data.forEach((row: any) => { s[row.key] = row.value; });
        setSettings((prev) => ({ ...prev, ...s }));
      }
      if (descRes.data) setDescriptions(descRes.data as LandingDescription[]);
    };
    fetchData();
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

    // Client-side pre-validation
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Format file tidak didukung", description: "Hanya JPEG, PNG, dan WebP yang diizinkan.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File terlalu besar", description: "Maksimal 5 MB.", variant: "destructive" });
      return;
    }

    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data, error } = await supabase.functions.invoke("upload-payment-proof", {
        body: formData,
      });

      if (error) throw error;
      if (data?.path) {
        // Store the file path (not public URL) as proof reference
        const storagePath = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/payment-proofs/${data.path}`;
        setProofUrl(storagePath);
        if (selectedShow.is_subscription) {
          setPurchaseStep("info");
        }
      }
    } catch {
      toast({ title: "Upload gagal", description: "Silakan coba lagi.", variant: "destructive" });
    }
    setUploadingProof(false);
  };

  const handleSubmitSubscription = async () => {
    if (!selectedShow || !proofUrl) return;
    await supabase.from("subscription_orders").insert({
      show_id: selectedShow.id,
      phone,
      email,
      payment_proof_url: proofUrl,
    });
    setPurchaseStep("done");
  };

  const handleConfirmRegular = () => {
    if (!selectedShow || !settings.whatsapp_number) return;
    const msg = encodeURIComponent(
      `✅ *KONFIRMASI PEMBAYARAN*\n\n🎭 Show: *${selectedShow.title}*\n💰 Harga: ${selectedShow.price}${selectedShow.schedule_date ? `\n📅 Jadwal: ${selectedShow.schedule_date} ${selectedShow.schedule_time}` : ""}\n\n📸 Bukti Pembayaran:\n${proofUrl}\n\nMohon dikonfirmasi, terima kasih! 🙏`
    );
    window.open(`https://wa.me/${settings.whatsapp_number}?text=${msg}`, "_blank");
    setSelectedShow(null);
  };

  const regularShows = shows.filter((s) => !s.is_subscription);
  const subscriptionShows = shows.filter((s) => s.is_subscription);

  const menuItems = [
    ...(settings.whatsapp_channel ? [{
      icon: <Radio className="h-5 w-5 text-primary" />,
      label: "Saluran WhatsApp",
      description: "Ikuti saluran info terbaru",
      action: () => window.open(settings.whatsapp_channel, "_blank"),
    }] : []),
    ...(settings.whatsapp_number ? [{
      icon: <Phone className="h-5 w-5 text-success" />,
      label: "Hubungi Admin",
      description: "Chat langsung via WhatsApp",
      action: () => window.open(`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent("Halo admin")}`, "_blank"),
    }] : []),
    {
      icon: <CreditCard className="h-5 w-5 text-yellow-500" />,
      label: "Informasi Langganan",
      description: settings.subscription_info || "Info paket berlangganan",
      action: () => { document.getElementById("subscriptions")?.scrollIntoView({ behavior: "smooth" }); },
      expandable: !!settings.subscription_info,
    },
    {
      icon: <Ticket className="h-5 w-5 text-primary" />,
      label: "Data Show",
      description: `${shows.length} show tersedia`,
      action: () => { document.getElementById("shows")?.scrollIntoView({ behavior: "smooth" }); },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="RealTime48" className="h-8 w-8" />
            <span className="text-sm font-bold text-foreground">Real<span className="text-primary">Time48</span></span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button className="rounded-lg bg-secondary p-2 text-secondary-foreground transition hover:bg-secondary/80">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 border-border bg-card">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-foreground">
                  <img src={logo} alt="" className="h-6 w-6" /> RealTime48
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                {menuItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="mt-0.5 shrink-0">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1 w-1 rounded-full bg-primary/40"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
              animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3 }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center px-4">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <img src={logo} alt="RealTime48" className="mx-auto mb-6 h-20 w-20 md:h-28 md:w-28 animate-float" />
          </motion.div>
          <motion.h1
            className="mb-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          >
            Real<span className="text-primary">Time48</span>
          </motion.h1>
          <motion.p
            className="mx-auto mb-8 max-w-md text-muted-foreground md:text-lg"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
          >
            {settings.site_title}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }}>
            <a
              href="#shows"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
            >
              <Ticket className="h-5 w-5" /> Lihat Show
            </a>
          </motion.div>
        </div>
      </section>

      {/* Descriptions Section */}
      {descriptions.length > 0 && (
        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {descriptions.map((desc, i) => (
              <motion.div
                key={desc.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <span className="mb-3 inline-block text-3xl">{desc.icon}</span>
                <h3 className="mb-2 text-lg font-bold text-foreground">{desc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc.content}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Subscription Card Section */}
      {subscriptionShows.length > 0 && (
        <section id="subscriptions" className="px-4 py-8">
          <div className="mx-auto max-w-6xl">
            <motion.h2
              className="mb-8 text-center text-3xl font-bold text-foreground md:text-4xl"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            >
              <Crown className="mr-2 inline h-8 w-8 text-yellow-500" /> Paket Langganan
            </motion.h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {subscriptionShows.map((show, i) => {
                const confirmed = subscriberCounts[show.id] || 0;
                const spotsLeft = show.max_subscribers > 0 ? show.max_subscribers - confirmed : null;
                const isFull = spotsLeft !== null && spotsLeft <= 0;
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
                    <div className={`absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                      isFull ? "bg-destructive text-destructive-foreground" : "bg-yellow-500 text-background"
                    }`}>
                      <Sparkles className="h-3 w-3" /> {isFull ? "LANGGANAN PENUH" : "LANGGANAN"}
                    </div>

                    <div className="relative h-48 overflow-hidden">
                      {show.background_image_url ? (
                        <img src={show.background_image_url} alt={show.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
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
                        <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-sm font-bold text-yellow-500">
                          {show.price}
                        </span>
                        {spotsLeft !== null && (
                          <span className="text-xs text-muted-foreground">
                            {confirmed}/{show.max_subscribers} terdaftar
                          </span>
                        )}
                      </div>

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
                        {isFull ? "🔒 Langganan Penuh" : "Berlangganan"}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Regular Shows Section */}
      <section id="shows" className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            className="mb-12 text-center text-3xl font-bold text-foreground md:text-4xl"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          >
            🎭 Jadwal Show
          </motion.h2>

          {regularShows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">Belum ada show tersedia</p>
              <p className="mt-2 text-muted-foreground">{settings.purchase_message}</p>
              {settings.whatsapp_number && (
                <a
                  href={`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent("Halo, saya ingin bertanya tentang streaming")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 font-semibold text-primary-foreground transition hover:bg-success/90"
                >
                  <MessageCircle className="h-4 w-4" /> Hubungi WhatsApp
                </a>
              )}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {regularShows.map((show, i) => (
                <motion.div
                  key={show.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className="relative h-48 overflow-hidden">
                    {show.background_image_url ? (
                      <img src={show.background_image_url} alt={show.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/10">
                        <Ticket className="h-16 w-16 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="text-xl font-bold text-foreground">{show.title}</h3>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{show.price}</span>
                    {show.schedule_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary" />{show.schedule_date}
                      </div>
                    )}
                    {show.schedule_time && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary" />{show.schedule_time}
                      </div>
                    )}
                    {show.lineup && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Users className="mt-0.5 h-4 w-4 text-primary" />
                        <span className="line-clamp-2">{show.lineup}</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleBuy(show)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                    >
                      <MessageCircle className="h-4 w-4" /> Beli Tiket
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <img src={logo} alt="RealTime48" className="h-6 w-6" />
          <span className="text-sm font-semibold text-foreground">Real<span className="text-primary">Time48</span></span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Secure Streaming Platform</p>
      </footer>

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
                <p className="text-sm text-muted-foreground">
                  Silakan scan QRIS di bawah untuk melakukan pembayaran:
                </p>
                {selectedShow.qris_image_url ? (
                  <img src={selectedShow.qris_image_url} alt="QRIS" className="mx-auto max-h-64 rounded-lg" />
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground">
                    QRIS belum tersedia
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Setelah melakukan pembayaran, upload bukti transfer:
                </p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-4 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10">
                  <Upload className="h-4 w-4" />
                  {uploadingProof ? "Mengupload..." : "Upload Bukti Pembayaran"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} />
                </label>
                {proofUrl && !selectedShow.is_subscription && (
                  <div className="space-y-4 rounded-xl border border-success/30 bg-success/5 p-4">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">Bukti Berhasil Diupload! 🎉</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Terima kasih telah melakukan pembayaran untuk <strong className="text-foreground">{selectedShow.title}</strong>. 
                      Silakan kirim bukti pembayaran ke admin untuk konfirmasi dan mendapatkan token akses streaming Anda.
                    </p>
                    <div className="rounded-lg bg-card p-3 text-xs text-muted-foreground">
                      <p className="mb-1 font-medium text-foreground">📋 Detail Pesanan:</p>
                      <p>🎭 Show: {selectedShow.title}</p>
                      <p>💰 Harga: {selectedShow.price}</p>
                      {selectedShow.schedule_date && <p>📅 Jadwal: {selectedShow.schedule_date} {selectedShow.schedule_time}</p>}
                    </div>
                    <Button onClick={handleConfirmRegular} className="w-full gap-2 bg-success hover:bg-success/90 text-primary-foreground">
                      <MessageCircle className="h-4 w-4" /> Kirim Bukti ke Admin via WhatsApp
                    </Button>
                  </div>
                )}
              </div>
            )}

            {purchaseStep === "info" && selectedShow.is_subscription && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle className="h-4 w-4" /> Bukti pembayaran berhasil diupload
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

            {purchaseStep === "done" && selectedShow.is_subscription && (
              <div className="space-y-4 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-success" />
                <h4 className="text-lg font-bold text-foreground">Pendaftaran Berhasil!</h4>
                <p className="text-sm text-muted-foreground">
                  Data dan bukti pembayaran Anda telah dikirim. Admin akan mengkonfirmasi pembayaran Anda.
                </p>
                {selectedShow.group_link && (
                  <a
                    href={selectedShow.group_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 font-semibold text-primary-foreground transition hover:bg-success/90"
                  >
                    🔗 Masuk ke Grup
                  </a>
                )}
              </div>
            )}

            <button
              onClick={() => setSelectedShow(null)}
              className="mt-4 w-full rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80"
            >
              Tutup
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Index;
