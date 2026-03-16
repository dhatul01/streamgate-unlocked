import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import heroBg from "@/assets/hero-bg.jpg";
import { Calendar, Clock, Users, MessageCircle, Ticket, Star, Upload, CheckCircle, Crown, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
}

const Index = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [descriptions, setDescriptions] = useState<LandingDescription[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({
    whatsapp_number: "",
    purchase_message: "",
    site_title: "RealTime48 Streaming",
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
        // Fetch subscriber counts for subscription shows
        const subShows = (showsRes.data as Show[]).filter((s) => s.is_subscription);
        if (subShows.length > 0) {
          const counts: Record<string, number> = {};
          for (const s of subShows) {
            const { count } = await supabase
              .from("subscription_orders")
              .select("*", { count: "exact", head: true })
              .eq("show_id", s.id)
              .eq("status", "confirmed");
            counts[s.id] = count || 0;
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
    setUploadingProof(true);
    const ext = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("payment-proofs").upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(fileName);
      setProofUrl(urlData.publicUrl);
      if (selectedShow.is_subscription) {
        setPurchaseStep("info");
      }
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
      `Halo, saya telah melakukan pembayaran untuk ${selectedShow.title} (${selectedShow.price}). Berikut bukti pembayaran saya: ${proofUrl}`
    );
    window.open(`https://wa.me/${settings.whatsapp_number}?text=${msg}`, "_blank");
    setSelectedShow(null);
  };

  const regularShows = shows.filter((s) => !s.is_subscription);
  const subscriptionShows = shows.filter((s) => s.is_subscription);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
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
        <section className="px-4 py-8">
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
                return (
                  <motion.div
                    key={show.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="group relative overflow-hidden rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-b from-yellow-500/5 to-card transition-all hover:border-yellow-500 hover:shadow-2xl hover:shadow-yellow-500/10"
                  >
                    {/* Premium badge */}
                    <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-yellow-500 px-3 py-1 text-xs font-black text-background">
                      <Sparkles className="h-3 w-3" /> LANGGANAN
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
                        disabled={spotsLeft !== null && spotsLeft <= 0}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 py-3 font-bold text-background transition-all hover:shadow-lg hover:shadow-yellow-500/25 disabled:opacity-50"
                      >
                        <Star className="h-4 w-4" />
                        {spotsLeft !== null && spotsLeft <= 0 ? "Kuota Penuh" : "Berlangganan"}
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

            {/* Step 1: QRIS */}
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle className="h-4 w-4" /> Bukti berhasil diupload
                    </div>
                    <Button onClick={handleConfirmRegular} className="w-full">
                      <MessageCircle className="mr-2 h-4 w-4" /> Konfirmasi via WhatsApp
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Info (subscription only) */}
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

            {/* Step 3: Done (subscription only) */}
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
