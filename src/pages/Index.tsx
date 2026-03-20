import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";
import heroBg from "@/assets/hero-bg.jpg";
import LandingFloatingEmojis from "@/components/viewer/LandingFloatingEmojis";
import { Calendar, Clock, Users, MessageCircle, Ticket, Star, Upload, CheckCircle, Crown, Sparkles, Menu, X, Phone, Info, Radio, CreditCard, Mail, Coins, User, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  group_link?: string;
  is_order_closed: boolean;
  category?: string;
  category_member?: string;
  coin_price: number;
}

const SHOW_CATEGORIES: Record<string, { label: string; color: string }> = {
  regular: { label: "🎭 Reguler", color: "bg-primary/20 text-primary" },
  birthday: { label: "🎂 Ulang Tahun/STS", color: "bg-pink-500/20 text-pink-400" },
  special: { label: "⭐ Spesial", color: "bg-yellow-500/20 text-yellow-400" },
  anniversary: { label: "🎉 Anniversary", color: "bg-purple-500/20 text-purple-400" },
  last_show: { label: "👋 Last Show", color: "bg-red-500/20 text-red-400" },
};

interface LandingDescription {
  id: string;
  title: string;
  content: string;
  icon: string;
  image_url: string;
  text_align: string;
}

interface SiteSettings {
  whatsapp_number: string;
  purchase_message: string;
  site_title: string;
  whatsapp_channel: string;
  subscription_info: string;
  landing_description_width: string;
  landing_desc_subtitle: string;
  landing_desc_title: string;
  landing_desc_quote: string;
  landing_desc_layout: string;
  [key: string]: string;
}

const Index = () => {
  const { toast } = useToast();
  const [shows, setShows] = useState<Show[]>([]);
  const [descriptions, setDescriptions] = useState<LandingDescription[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({
    whatsapp_number: "",
    purchase_message: "",
    site_title: "RealTime48 Streaming",
    whatsapp_channel: "",
    subscription_info: "",
    landing_description_width: "medium",
    landing_desc_subtitle: "",
    landing_desc_title: "",
    landing_desc_quote: "",
    landing_desc_layout: "list",
  });
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<"qris" | "upload" | "info" | "done">("qris");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

  // Coin purchase state
  const [coinUser, setCoinUser] = useState<any>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [coinUsername, setCoinUsername] = useState("");
  const [coinShowTarget, setCoinShowTarget] = useState<Show | null>(null);
  const [coinRedeeming, setCoinRedeeming] = useState(false);
  const [coinResult, setCoinResult] = useState<{ token_code: string; remaining_balance: number } | null>(null);

  const fetchData = async () => {
    const [showsRes, settingsRes, descRes] = await Promise.all([
      supabase.rpc("get_public_shows"),
      supabase.from("site_settings").select("*"),
      supabase.from("landing_descriptions").select("*").eq("is_active", true).order("sort_order"),
    ]);
    if (showsRes.data) {
      setShows(showsRes.data as Show[]);
      const subShows = (showsRes.data as Show[]).filter((s) => s.is_subscription);
      if (subShows.length > 0) {
        const counts: Record<string, number> = {};
        for (const s of subShows) {
          const { data: count } = await supabase.rpc("get_order_count", { _show_id: s.id });
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

  useEffect(() => {
    fetchData();

    // Fetch coin user & balance
    const fetchCoinUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCoinUser(user);
        const [balRes, profileRes] = await Promise.all([
          (supabase.from as any)("coin_balances").select("balance").eq("user_id", user.id).maybeSingle(),
          (supabase.from as any)("profiles").select("username").eq("id", user.id).maybeSingle(),
        ]);
        setCoinBalance(balRes.data?.balance || 0);
        setCoinUsername(profileRes.data?.username || user.user_metadata?.username || "");
      }
    };
    fetchCoinUser();

    // Realtime for shows and orders
    const showCh = supabase.channel("idx-shows")
      .on("postgres_changes", { event: "*", schema: "public", table: "shows" }, () => fetchData())
      .subscribe();
    const orderCh = supabase.channel("idx-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscription_orders" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(showCh); supabase.removeChannel(orderCh); };
  }, []);

  const handleBuy = (show: Show) => {
    setSelectedShow(show);
    setPurchaseStep(show.is_subscription ? "qris" : "info");
    setProofUrl("");
    setPhone("");
    setEmail("");
  };

  const handleCoinBuy = (show: Show) => {
    if (!coinUser) {
      toast({ title: "Login terlebih dahulu", description: "Silakan login di halaman /auth untuk membeli dengan koin.", variant: "destructive" });
      return;
    }
    setCoinShowTarget(show);
    setCoinResult(null);
  };

  const handleCoinRedeem = async () => {
    if (!coinShowTarget) return;
    setCoinRedeeming(true);
    const { data, error } = await (supabase.rpc as any)("redeem_coins_for_token", { _show_id: coinShowTarget.id });
    setCoinRedeeming(false);
    if (error || !data?.success) {
      toast({ title: "Gagal menukar koin", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    setCoinResult({ token_code: data.token_code, remaining_balance: data.remaining_balance });
    setCoinBalance(data.remaining_balance);
  };


  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedShow) return;

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
      formData.append("show_id", selectedShow.id);

      const { data, error } = await supabase.functions.invoke("upload-payment-proof", {
        body: formData,
      });

      if (error) throw error;
      if (data?.path) {
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

  const handleConfirmRegular = () => {
    if (!selectedShow || !settings.whatsapp_number) return;
    const now = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
    const msg = encodeURIComponent(
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎬 *PESANAN TIKET BARU*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎭 *Show:* ${selectedShow.title}\n` +
      `💰 *Harga:* ${selectedShow.price}\n` +
      `${selectedShow.schedule_date ? `📅 *Jadwal:* ${selectedShow.schedule_date} ${selectedShow.schedule_time}\n` : ""}` +
      `${selectedShow.lineup ? `👥 *Lineup:* ${selectedShow.lineup}\n` : ""}` +
      `\n` +
      `📋 *DATA PEMBELI*\n` +
      `📧 Email: ${email}\n` +
      `🕐 Waktu Order: ${now}\n\n` +
      `📸 *Bukti pembayaran akan dikirim menyusul*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Dikirim dari RealTime48_ ✨`
    );
    window.open(`https://wa.me/${settings.whatsapp_number}?text=${msg}`, "_blank");
    setSelectedShow(null);
  };

  const regularShows = shows.filter((s) => !s.is_subscription);
  const subscriptionShows = shows.filter((s) => s.is_subscription);

  const menuItems = [
    ...(settings.whatsapp_channel ? [{
      icon: <Radio className="h-5 w-5 tv:h-7 tv:w-7 text-primary" />,
      label: "Saluran WhatsApp",
      description: "Ikuti saluran info terbaru",
      action: () => window.open(settings.whatsapp_channel, "_blank"),
    }] : []),
    ...(settings.whatsapp_number ? [{
      icon: <Phone className="h-5 w-5 tv:h-7 tv:w-7 text-success" />,
      label: "Hubungi Admin",
      description: "Chat langsung via WhatsApp",
      action: () => window.open(`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent("Halo admin")}`, "_blank"),
    }] : []),
    {
      icon: <CreditCard className="h-5 w-5 tv:h-7 tv:w-7 text-yellow-500" />,
      label: "Informasi Langganan",
      description: settings.subscription_info || "Info paket berlangganan",
      action: () => { window.location.href = "/membership"; },
    },
    {
      icon: <Coins className="h-5 w-5 tv:h-7 tv:w-7 text-warning" />,
      label: "Coin Shop",
      description: "Beli koin untuk akses nonton show",
      action: () => { window.location.href = "/coins"; },
    },
    {
      icon: <Ticket className="h-5 w-5 tv:h-7 tv:w-7 text-primary" />,
      label: "Data Show",
      description: `${regularShows.length} show tersedia`,
      action: () => { document.getElementById("shows")?.scrollIntoView({ behavior: "smooth" }); },
    },
  ];

  return (
    <div className="relative min-h-screen bg-background">
      <LandingFloatingEmojis />
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl tv:max-w-[1600px] items-center justify-between px-4 py-3 tv:py-5 tv:px-8">
          <div className="flex items-center gap-2 tv:gap-3">
            <img src={logo} alt="RealTime48" className="h-8 w-8 tv:h-12 tv:w-12 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" />
            <span className="text-sm font-bold text-foreground tv:text-xl">Real<span className="text-primary">Time48</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
            <SheetTrigger asChild>
              <button className="rounded-lg bg-secondary p-2 tv:p-3 text-secondary-foreground transition hover:bg-secondary/80">
                <Menu className="h-5 w-5 tv:h-7 tv:w-7" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 tv:w-[420px] border-border bg-card">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-foreground tv:text-xl">
                  <img src={logo} alt="" className="h-6 w-6 tv:h-9 tv:w-9 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" /> RealTime48
                </SheetTitle>
              </SheetHeader>

              {/* User profile & coin balance section */}
              {coinUser && (
                <div className="mt-4 rounded-xl border border-border bg-background p-4 tv:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground tv:text-base">{coinUsername || "User"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Coins className="h-3.5 w-3.5 text-warning" />
                        <span className="text-xs font-bold text-warning">{coinBalance} Koin</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href="/profile" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/80 tv:text-sm">
                      <User className="h-3.5 w-3.5 text-primary" /> Profil
                    </a>
                    <a href="/coins" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs font-semibold text-warning transition hover:bg-warning/20 tv:text-sm">
                      <Coins className="h-3.5 w-3.5" /> Coin Shop
                    </a>
                  </div>
                </div>
              )}
              {!coinUser && (
                <div className="mt-4 rounded-xl border border-border bg-background p-4 tv:p-5">
                  <a href="/auth" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
                    <User className="h-4 w-4" /> Login / Daftar
                  </a>
                </div>
              )}

              <div className="mt-4 space-y-2 tv:space-y-3">
                {menuItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-4 tv:p-5 text-left transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="mt-0.5 shrink-0">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground tv:text-base">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3 tv:text-sm">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden pt-16 tv:pt-24">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1 w-1 tv:h-2 tv:w-2 rounded-full bg-primary/40"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
              animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3 }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center px-4">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <img src={logo} alt="RealTime48" className="mx-auto mb-6 h-20 w-20 md:h-28 md:w-28 tv:h-40 tv:w-40 animate-float rounded-full border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
          </motion.div>
          <motion.h1
            className="mb-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl tv:text-8xl"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          >
            Real<span className="text-primary">Time48</span>
          </motion.h1>
          <motion.p
            className="mx-auto mb-8 max-w-md text-muted-foreground md:text-lg tv:text-2xl tv:max-w-2xl"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
          >
            {settings.site_title}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }}>
            <a
              href="#shows"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 tv:px-12 tv:py-5 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 tv:text-xl"
            >
              <Ticket className="h-5 w-5 tv:h-7 tv:w-7" /> Lihat Show
            </a>
          </motion.div>
        </div>
      </section>

      {/* Descriptions Section */}
      {descriptions.length > 0 && (
        <section className="py-16 tv:py-24">
          <div className="mx-auto max-w-7xl tv:max-w-[1800px] px-4 tv:px-8">
            {/* Section Header */}
            {(settings.landing_desc_subtitle || settings.landing_desc_title || settings.landing_desc_quote) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-12 text-center tv:mb-16"
              >
                {settings.landing_desc_subtitle && (
                  <p className="mb-3 text-sm font-bold uppercase tracking-widest text-primary tv:text-base">
                    {settings.landing_desc_subtitle}
                  </p>
                )}
                {settings.landing_desc_title && (
                  <h2 className="mb-4 text-3xl font-extrabold text-foreground md:text-4xl tv:text-6xl">
                    {settings.landing_desc_title.split(/(\*[^*]+\*)/).map((part, idx) =>
                      part.startsWith("*") && part.endsWith("*") ? (
                        <span key={idx} className="text-primary">{part.slice(1, -1)}</span>
                      ) : (
                        <span key={idx}>{part}</span>
                      )
                    )}
                  </h2>
                )}
                {settings.landing_desc_quote && (
                  <p className="mx-auto max-w-2xl text-sm italic text-muted-foreground md:text-base tv:text-lg tv:max-w-3xl">
                    "{settings.landing_desc_quote}"
                  </p>
                )}
              </motion.div>
            )}

            {/* Card Grid Layout */}
            {settings.landing_desc_layout === "cards" ? (
              <div className="grid gap-6 tv:gap-8 md:grid-cols-2 lg:grid-cols-3">
                {descriptions.map((desc, i) => (
                  <motion.div
                    key={desc.id}
                    initial={{ opacity: 0, y: 30, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card/90 backdrop-blur-sm p-6 md:p-8 tv:p-10 transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
                  >
                    {desc.image_url && (
                      <img src={desc.image_url} alt={desc.title} className="mb-4 h-40 w-full rounded-xl object-cover" />
                    )}
                    <span className="mb-4 flex h-12 w-12 tv:h-16 tv:w-16 items-center justify-center rounded-xl bg-primary/15 text-2xl tv:text-3xl">
                      {desc.icon}
                    </span>
                    <h3 className="mb-3 text-lg font-bold text-foreground md:text-xl tv:text-2xl">{desc.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed tv:text-base whitespace-pre-line">{desc.content}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              /* List Layout (original) */
              <div className="space-y-6 tv:space-y-8">
                {descriptions.map((desc, i) => {
                  const alignClass = desc.text_align === "left" ? "text-left" : desc.text_align === "right" ? "text-right" : "text-center";
                  return (
                    <motion.div
                      key={desc.id}
                      initial={{ opacity: 0, y: 30, scale: 0.97 }}
                      whileInView={{ opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                      className={`group relative w-full overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 ${alignClass}`}
                    >
                      {desc.image_url ? (
                        <div className="md:flex">
                          <div className="relative h-52 overflow-hidden md:h-auto md:w-2/5 lg:w-1/3">
                            <img
                              src={desc.image_url}
                              alt={desc.title}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/20 md:bg-gradient-to-l" />
                          </div>
                          <div className="flex flex-1 flex-col justify-center p-6 md:p-8 tv:p-12">
                            <span className="mb-3 inline-block text-3xl tv:text-5xl">{desc.icon}</span>
                            <h3 className="mb-3 text-xl font-bold text-foreground md:text-2xl tv:text-3xl">{desc.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed md:text-base tv:text-lg whitespace-pre-line">{desc.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 md:p-8 tv:p-12">
                          <span className="mb-3 inline-block text-3xl tv:text-5xl">{desc.icon}</span>
                          <h3 className="mb-3 text-xl font-bold text-foreground md:text-2xl tv:text-3xl">{desc.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed md:text-base tv:text-lg whitespace-pre-line">{desc.content}</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Subscription Info Banner */}
      {subscriptionShows.length > 0 && (
        <section id="subscriptions" className="px-4 py-6 tv:py-10 tv:px-8">
          <div className="mx-auto max-w-4xl tv:max-w-[1200px]">
            {(() => {
              const hasOpen = subscriptionShows.some((show) => {
                const count = subscriberCounts[show.id] || 0;
                const spotsLeft = show.max_subscribers > 0 ? show.max_subscribers - count : null;
                const isFull = (spotsLeft !== null && spotsLeft <= 0) || show.is_order_closed;
                return !isFull;
              });
              const allFull = subscriptionShows.every((show) => {
                const count = subscriberCounts[show.id] || 0;
                const spotsLeft = show.max_subscribers > 0 ? show.max_subscribers - count : null;
                return (spotsLeft !== null && spotsLeft <= 0);
              });
              const allClosed = subscriptionShows.every((show) => show.is_order_closed);

              if (hasOpen) {
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="flex flex-col items-center gap-4 rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 p-6 tv:p-10 text-center"
                  >
                    <div className="flex items-center gap-2">
                      <Crown className="h-6 w-6 tv:h-8 tv:w-8 text-yellow-500" />
                      <h3 className="text-lg font-bold text-foreground tv:text-2xl">Langganan Dibuka! 🎉</h3>
                    </div>
                    <p className="text-sm text-muted-foreground tv:text-base">Segera daftar membership untuk akses eksklusif streaming. Kuota terbatas!</p>
                    <a
                      href="/membership"
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-3 tv:px-10 tv:py-4 font-bold text-background transition hover:shadow-lg hover:shadow-yellow-500/25 tv:text-lg"
                    >
                      <Star className="h-4 w-4 tv:h-5 tv:w-5" /> Daftar Membership
                    </a>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="flex flex-col items-center gap-3 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-6 tv:p-10 text-center"
                >
                  <div className="flex items-center gap-2">
                    <Crown className="h-6 w-6 tv:h-8 tv:w-8 text-destructive" />
                    <h3 className="text-lg font-bold text-foreground tv:text-2xl">
                      {allClosed ? "🔒 Pendaftaran Langganan Ditutup" : allFull ? "🔒 Langganan Penuh" : "🔒 Langganan Tidak Tersedia"}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground tv:text-base">
                    {allClosed ? "Pendaftaran membership sedang ditutup oleh admin. Nantikan pembukaan selanjutnya!" : "Semua kuota membership telah terisi. Pantau terus untuk pembukaan berikutnya!"}
                  </p>
                </motion.div>
              );
            })()}
          </div>
        </section>
      )}

      {/* Regular Shows Section */}
      <section id="shows" className="px-4 py-16 md:py-24 tv:py-32 tv:px-8">
        <div className="mx-auto max-w-6xl tv:max-w-[1600px]">
          <motion.h2
            className="mb-12 text-center text-3xl font-bold text-foreground md:text-4xl tv:text-5xl tv:mb-16"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          >
            🎭 Jadwal Show
          </motion.h2>

          {regularShows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 tv:p-20 text-center">
              <MessageCircle className="mx-auto mb-4 h-12 w-12 tv:h-16 tv:w-16 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground tv:text-2xl">Belum ada show tersedia</p>
              <p className="mt-2 text-muted-foreground tv:text-lg">{settings.purchase_message}</p>
              {settings.whatsapp_number && (
                <a
                  href={`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent("Halo, saya ingin bertanya tentang streaming")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 tv:px-10 tv:py-4 font-semibold text-primary-foreground transition hover:bg-success/90 tv:text-lg"
                >
                  <MessageCircle className="h-4 w-4 tv:h-6 tv:w-6" /> Hubungi WhatsApp
                </a>
              )}
            </div>
          ) : (
            <div className="grid gap-6 tv:gap-8 md:grid-cols-2 lg:grid-cols-3">
              {regularShows.map((show, i) => (
                <motion.div
                  key={show.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group relative overflow-hidden rounded-2xl tv:rounded-3xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className="relative h-48 tv:h-72 overflow-hidden">
                    {show.background_image_url ? (
                      <img src={show.background_image_url} alt={show.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/10">
                        <Ticket className="h-16 w-16 tv:h-24 tv:w-24 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                    {/* Category badge */}
                    {show.category && show.category !== "regular" && (() => {
                      const cat = SHOW_CATEGORIES[show.category] || SHOW_CATEGORIES.regular;
                      const memberText = show.category_member && (show.category === "birthday" || show.category === "last_show")
                        ? ` — ${show.category_member}` : "";
                      return (
                        <span className={`absolute top-3 left-3 tv:top-4 tv:left-4 rounded-full px-3 py-1 text-[10px] tv:text-xs font-bold backdrop-blur-sm ${cat.color}`}>
                          {cat.label}{memberText}
                        </span>
                      );
                    })()}
                    <div className="absolute bottom-3 left-4 right-4 tv:bottom-5 tv:left-6">
                      <h3 className="text-xl font-bold text-foreground tv:text-3xl">{show.title}</h3>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 tv:p-6 tv:space-y-4">
                    {show.coin_price > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-warning tv:text-base">
                        <Coins className="h-4 w-4 tv:h-5 tv:w-5" />
                        <span className="font-semibold">{show.coin_price} Koin</span>
                      </div>
                    )}
                    <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground tv:text-lg tv:px-4 tv:py-1.5">{show.price}</span>
                    {show.schedule_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground tv:text-base">
                        <Calendar className="h-4 w-4 tv:h-5 tv:w-5 text-primary" />{show.schedule_date}
                      </div>
                    )}
                    {show.schedule_time && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground tv:text-base">
                        <Clock className="h-4 w-4 tv:h-5 tv:w-5 text-primary" />{show.schedule_time}
                      </div>
                    )}
                    {show.lineup && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground tv:text-base">
                        <Users className="mt-0.5 h-4 w-4 tv:h-5 tv:w-5 text-primary" />
                        <span className="line-clamp-2">{show.lineup}</span>
                      </div>
                    )}
                    <div className="mt-2 flex flex-col gap-2">
                      {show.coin_price > 0 && (
                        <button
                          onClick={() => handleCoinBuy(show)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-warning py-3 tv:py-4 font-semibold text-warning-foreground transition-all hover:bg-warning/90 hover:shadow-lg hover:shadow-warning/25 tv:text-lg tv:rounded-2xl"
                        >
                          <Coins className="h-4 w-4 tv:h-6 tv:w-6" /> Beli dengan {show.coin_price} Koin
                        </button>
                      )}
                      <button
                        onClick={() => handleBuy(show)}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 tv:py-4 font-semibold transition-all tv:text-lg tv:rounded-2xl ${
                          show.coin_price > 0
                            ? "bg-muted text-muted-foreground hover:bg-muted/80"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                        }`}
                      >
                        <MessageCircle className="h-4 w-4 tv:h-6 tv:w-6" /> {show.coin_price > 0 ? "Beli via QRIS" : "Beli Tiket"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8 tv:py-12 text-center">
        <div className="flex items-center justify-center gap-2 tv:gap-3">
          <img src={logo} alt="RealTime48" className="h-6 w-6 tv:h-10 tv:w-10 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" />
          <span className="text-sm font-semibold text-foreground tv:text-xl">Real<span className="text-primary">Time48</span></span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground tv:text-base">Secure Streaming Platform</p>
      </footer>

      {/* Purchase Modal */}
      {selectedShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md tv:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 tv:p-10"
          >
            <h3 className="mb-1 text-lg font-bold text-foreground tv:text-2xl">{selectedShow.title}</h3>
            <p className="mb-4 text-sm text-muted-foreground tv:text-base">{selectedShow.price}</p>

            {/* Regular show: collect email then send WhatsApp */}
            {!selectedShow.is_subscription && purchaseStep === "info" && (
              <div className="space-y-4 tv:space-y-6">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 tv:p-6">
                  <p className="text-sm text-muted-foreground tv:text-base">
                    Silakan scan QRIS di bawah, lalu kirim bukti transfer secara manual ke admin via WhatsApp.
                  </p>
                </div>
                {selectedShow.qris_image_url ? (
                  <img src={selectedShow.qris_image_url} alt="QRIS" className="mx-auto w-full max-w-sm rounded-lg object-contain" />
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground tv:text-base tv:p-12">
                    QRIS belum tersedia
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground tv:text-sm">
                      <Mail className="h-3.5 w-3.5" /> Email Anda
                    </label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="bg-background tv:h-12 tv:text-base" />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 tv:p-5">
                  <p className="mb-2 text-xs font-semibold text-foreground tv:text-sm">📋 Ringkasan Pesanan</p>
                  <div className="space-y-1 text-xs text-muted-foreground tv:text-sm">
                    <p>🎭 {selectedShow.title}</p>
                    <p>💰 {selectedShow.price}</p>
                    {selectedShow.schedule_date && <p>📅 {selectedShow.schedule_date} {selectedShow.schedule_time}</p>}
                    {selectedShow.lineup && <p>👥 {selectedShow.lineup}</p>}
                  </div>
                </div>
                <Button
                  onClick={handleConfirmRegular}
                  disabled={!email.trim()}
                  className="w-full gap-2 bg-success hover:bg-success/90 text-primary-foreground tv:py-6 tv:text-lg"
                >
                  <MessageCircle className="h-4 w-4 tv:h-6 tv:w-6" /> Kirim Pesanan via WhatsApp
                </Button>
                <p className="text-[10px] text-center text-muted-foreground tv:text-xs">
                  * Anda akan diarahkan ke WhatsApp untuk mengirim data pesanan dan bukti transfer secara manual ke admin
                </p>
              </div>
            )}

            {/* Subscription show: QRIS + upload */}
            {selectedShow.is_subscription && purchaseStep === "qris" && (
              <div className="space-y-4 tv:space-y-6">
                <p className="text-sm text-muted-foreground tv:text-base">
                  Silakan scan QRIS di bawah untuk melakukan pembayaran:
                </p>
                {selectedShow.qris_image_url ? (
                  <img src={selectedShow.qris_image_url} alt="QRIS" className="mx-auto w-full max-w-sm rounded-lg object-contain" />
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground tv:text-base tv:p-12">
                    QRIS belum tersedia
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center tv:text-sm">
                  Setelah melakukan pembayaran, upload bukti transfer:
                </p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-4 tv:py-6 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10 tv:text-base">
                  <Upload className="h-4 w-4 tv:h-6 tv:w-6" />
                  {uploadingProof ? "Mengupload..." : "Upload Bukti Pembayaran"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} />
                </label>
              </div>
            )}

            {purchaseStep === "info" && selectedShow.is_subscription && (
              <div className="space-y-4 tv:space-y-6">
                <div className="flex items-center gap-2 text-sm text-success tv:text-base">
                  <CheckCircle className="h-4 w-4 tv:h-6 tv:w-6" /> Bukti pembayaran berhasil diupload
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground tv:text-sm">Nomor HP</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="bg-background tv:h-12 tv:text-base" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground tv:text-sm">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="bg-background tv:h-12 tv:text-base" />
                </div>
                <Button onClick={handleSubmitSubscription} disabled={!phone || !email} className="w-full tv:py-6 tv:text-lg">
                  Kirim Data Langganan
                </Button>
              </div>
            )}

            {purchaseStep === "done" && selectedShow.is_subscription && (
              <div className="space-y-4 tv:space-y-6 text-center">
                <CheckCircle className="mx-auto h-12 w-12 tv:h-16 tv:w-16 text-success" />
                <h4 className="text-lg font-bold text-foreground tv:text-2xl">Pendaftaran Berhasil!</h4>
                <p className="text-sm text-muted-foreground tv:text-base">
                  Data dan bukti pembayaran Anda telah dikirim. Admin akan mengkonfirmasi pembayaran Anda.
                </p>
                <p className="text-xs text-muted-foreground tv:text-sm">
                  Link grup akan dikirimkan setelah pembayaran dikonfirmasi.
                </p>
              </div>
            )}

            <button
              onClick={() => setSelectedShow(null)}
              className="mt-4 w-full rounded-xl bg-secondary py-3 tv:py-4 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 tv:text-base"
            >
              Tutup
            </button>
          </motion.div>
        </div>
      )}

      {/* Coin Purchase Dialog */}
      <Dialog open={!!coinShowTarget} onOpenChange={() => { setCoinShowTarget(null); setCoinResult(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🪙 Beli dengan Koin</DialogTitle>
            <DialogDescription>{coinShowTarget?.title}</DialogDescription>
          </DialogHeader>
          {!coinResult ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Show</span>
                  <span className="font-semibold text-foreground">{coinShowTarget?.title}</span>
                </div>
                {coinShowTarget?.schedule_date && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Jadwal</span>
                    <span className="text-foreground">{coinShowTarget.schedule_date} {coinShowTarget.schedule_time}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Harga</span>
                  <span className="font-bold text-warning">{coinShowTarget?.coin_price} Koin</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                  <span className="text-muted-foreground">Saldo Anda</span>
                  <span className={`font-bold ${coinBalance >= (coinShowTarget?.coin_price || 0) ? "text-success" : "text-destructive"}`}>
                    {coinBalance} Koin
                  </span>
                </div>
              </div>
              {coinBalance < (coinShowTarget?.coin_price || 0) ? (
                <div className="space-y-3">
                  <p className="text-center text-sm text-destructive">Koin tidak cukup untuk membeli show ini.</p>
                  <Button className="w-full" variant="outline" onClick={() => { setCoinShowTarget(null); window.location.href = "/coins"; }}>
                    <Coins className="mr-2 h-4 w-4" /> Beli Koin
                  </Button>
                </div>
              ) : (
                <Button className="w-full gap-2" onClick={handleCoinRedeem} disabled={coinRedeeming}>
                  <Coins className="h-4 w-4" />
                  {coinRedeeming ? "Memproses..." : `Bayar ${coinShowTarget?.coin_price} Koin`}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success" />
              <p className="font-semibold text-foreground">Pembelian Berhasil!</p>
              <p className="text-sm text-muted-foreground">Gunakan token ini untuk menonton show</p>
              <div className="rounded-lg bg-secondary p-4">
                <p className="font-mono text-lg font-bold text-primary">{coinResult.token_code}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/live?t=${coinResult.token_code}`);
                    toast({ title: "Link disalin!" });
                  }}
                >
                  <Copy className="h-4 w-4" /> Salin Link
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => { window.location.href = `/live?t=${coinResult.token_code}`; }}
                >
                  <Radio className="h-4 w-4" /> Tonton Sekarang
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Sisa saldo: <span className="font-bold text-warning">{coinResult.remaining_balance} koin</span></p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
