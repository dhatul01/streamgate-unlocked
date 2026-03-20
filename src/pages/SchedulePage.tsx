import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SharedNavbar from "@/components/viewer/SharedNavbar";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import {
  Calendar, Clock, Users, MessageCircle, Ticket, Upload, CheckCircle,
  Coins, Copy, Radio, Mail, Film, Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  replay_coin_price: number;
  is_replay: boolean;
  access_password: string;
}

const SHOW_CATEGORIES: Record<string, { label: string; color: string }> = {
  regular: { label: "🎭 Reguler", color: "bg-primary/20 text-primary" },
  birthday: { label: "🎂 Ulang Tahun/STS", color: "bg-pink-500/20 text-pink-400" },
  special: { label: "⭐ Spesial", color: "bg-yellow-500/20 text-yellow-400" },
  anniversary: { label: "🎉 Anniversary", color: "bg-purple-500/20 text-purple-400" },
  last_show: { label: "👋 Last Show", color: "bg-red-500/20 text-red-400" },
};

const SchedulePage = () => {
  const { toast } = useToast();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStreamLive, setIsStreamLive] = useState(true);
  const [settings, setSettings] = useState<{ whatsapp_number: string }>({ whatsapp_number: "" });

  // Purchase state
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<"qris" | "upload" | "info" | "done">("info");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Coin state
  const [coinUser, setCoinUser] = useState<any>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [coinShowTarget, setCoinShowTarget] = useState<Show | null>(null);
  const [coinRedeeming, setCoinRedeeming] = useState(false);
  const [coinResult, setCoinResult] = useState<{ token_code: string; remaining_balance: number; replay_password?: string; access_password?: string } | null>(null);
  const [redeemedTokens, setRedeemedTokens] = useState<Record<string, string>>({});
  const [replayPasswords, setReplayPasswords] = useState<Record<string, string>>({});
  const [accessPasswords, setAccessPasswords] = useState<Record<string, string>>({});

  const isShowPastSchedule = (show: Show) => {
    if (!show.schedule_date || !show.schedule_time) return false;
    try {
      const timeStr = show.schedule_time.replace(/\s*WIB\s*/i, "").trim();
      const showDate = new Date(`${show.schedule_date} ${timeStr}`);
      if (isNaN(showDate.getTime())) return false;
      return new Date() > showDate;
    } catch { return false; }
  };

  const isShowPast4Hours = (show: Show) => {
    if (!show.schedule_date || !show.schedule_time) return false;
    try {
      const timeStr = show.schedule_time.replace(/\s*WIB\s*/i, "").trim();
      const showDate = new Date(`${show.schedule_date} ${timeStr}`);
      if (isNaN(showDate.getTime())) return false;
      return new Date() > new Date(showDate.getTime() + 4 * 60 * 60 * 1000);
    } catch { return false; }
  };

  const isShowReplayMode = (show: Show) => {
    if (show.is_replay) return true;
    if (isShowPast4Hours(show)) return true;
    if (!isStreamLive && isShowPastSchedule(show)) return true;
    return false;
  };

  useEffect(() => {
    const fetchData = async () => {
      const [showsRes, settingsRes, streamRes] = await Promise.all([
        supabase.rpc("get_public_shows"),
        supabase.from("site_settings").select("*").in("key", ["whatsapp_number"]),
        supabase.from("streams").select("is_live").limit(1).single(),
      ]);
      if (streamRes.data) setIsStreamLive(streamRes.data.is_live);
      if (showsRes.data) {
        const isLive = streamRes.data?.is_live ?? true;
        const allShows = showsRes.data as Show[];
        const upcoming = allShows.filter(s => {
          if (s.is_subscription) return false;
          if (!s.schedule_date) return false;
          // Exclude if admin marked as replay
          if (s.is_replay) return false;
          // Exclude if past 4 hours (auto-replay)
          if (s.schedule_date && s.schedule_time) {
            try {
              const timeStr = s.schedule_time.replace(/\s*WIB\s*/i, "").trim();
              const showDate = new Date(`${s.schedule_date} ${timeStr}`);
              if (!isNaN(showDate.getTime()) && new Date() > new Date(showDate.getTime() + 4 * 60 * 60 * 1000)) return false;
              // Exclude if stream offline + past schedule
              if (!isLive && new Date() > showDate) return false;
            } catch {}
          }
          return true;
        });
        upcoming.sort((a, b) => {
          const dateA = a.schedule_date ? new Date(a.schedule_date).getTime() : 0;
          const dateB = b.schedule_date ? new Date(b.schedule_date).getTime() : 0;
          return dateB - dateA;
        });
        setShows(upcoming);
      }
      if (settingsRes.data) {
        const s: any = {};
        settingsRes.data.forEach((row: any) => { s[row.key] = row.value; });
        setSettings(prev => ({ ...prev, ...s }));
      }
      setLoading(false);
    };
    fetchData();

    // Coin user
    const fetchCoinUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCoinUser(user);
        const balRes = await supabase.from("coin_balances").select("balance").eq("user_id", user.id).maybeSingle();
        setCoinBalance(balRes.data?.balance || 0);
        try {
          const stored = JSON.parse(localStorage.getItem(`redeemed_tokens_${user.id}`) || "{}");
          setRedeemedTokens(stored);
        } catch {}
        try { setReplayPasswords(JSON.parse(localStorage.getItem(`replay_passwords_${user.id}`) || "{}")); } catch {}
        try {
          const storedAp = JSON.parse(localStorage.getItem(`access_passwords_${user.id}`) || "{}");
          const { data: pwData } = await supabase.rpc("get_purchased_show_passwords");
          if (pwData && typeof pwData === "object") {
            const merged = { ...storedAp, ...(pwData as Record<string, string>) };
            localStorage.setItem(`access_passwords_${user.id}`, JSON.stringify(merged));
            setAccessPasswords(merged);
          } else {
            setAccessPasswords(storedAp);
          }
        } catch {}

        const balCh = supabase
          .channel(`sched-balance-${user.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "coin_balances", filter: `user_id=eq.${user.id}` }, (payload: any) => {
            if (payload.new?.balance !== undefined) setCoinBalance(payload.new.balance);
          })
          .subscribe();
        return () => { supabase.removeChannel(balCh); };
      }
    };
    const cleanupBal = fetchCoinUser();

    const showCh = supabase.channel("sched-shows")
      .on("postgres_changes", { event: "*", schema: "public", table: "shows" }, () => { fetchData(); })
      .subscribe();
    const streamCh = supabase.channel("sched-streams")
      .on("postgres_changes", { event: "*", schema: "public", table: "streams" }, (p: any) => {
        if (p.new?.is_live !== undefined) setIsStreamLive(p.new.is_live);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(showCh);
      supabase.removeChannel(streamCh);
      cleanupBal.then(c => c?.());
    };
  }, []);

  const handleBuy = (show: Show) => {
    setSelectedShow(show);
    setPurchaseStep(show.is_subscription ? "qris" : "info");
    setProofUrl(""); setPhone(""); setEmail("");
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
    const { data, error } = await supabase.rpc("redeem_coins_for_token", { _show_id: coinShowTarget.id });
    setCoinRedeeming(false);
    const result = data as any;
    if (error || !result?.success) {
      toast({ title: "Gagal menukar koin", description: result?.error || error?.message, variant: "destructive" });
      return;
    }
    setCoinResult({ token_code: result.token_code, remaining_balance: result.remaining_balance, replay_password: result.replay_password, access_password: result.access_password });
    setCoinBalance(result.remaining_balance);
    if (coinUser) {
      const stored = JSON.parse(localStorage.getItem(`redeemed_tokens_${coinUser.id}`) || "{}");
      stored[coinShowTarget.id] = result.token_code;
      localStorage.setItem(`redeemed_tokens_${coinUser.id}`, JSON.stringify(stored));
      setRedeemedTokens(prev => ({ ...prev, [coinShowTarget.id]: result.token_code }));
      if (result.replay_password) {
        const sp = JSON.parse(localStorage.getItem(`replay_passwords_${coinUser.id}`) || "{}");
        sp[coinShowTarget.id] = result.replay_password;
        localStorage.setItem(`replay_passwords_${coinUser.id}`, JSON.stringify(sp));
        setReplayPasswords(prev => ({ ...prev, [coinShowTarget.id]: result.replay_password }));
      }
      if (result.access_password) {
        const sa = JSON.parse(localStorage.getItem(`access_passwords_${coinUser.id}`) || "{}");
        sa[coinShowTarget.id] = result.access_password;
        localStorage.setItem(`access_passwords_${coinUser.id}`, JSON.stringify(sa));
        setAccessPasswords(prev => ({ ...prev, [coinShowTarget.id]: result.access_password }));
      }
    }
  };

  const handleConfirmRegular = () => {
    if (!selectedShow || !settings.whatsapp_number) return;
    const now = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
    const msg = encodeURIComponent(
      `━━━━━━━━━━━━━━━━━━━━\n🎬 *PESANAN TIKET BARU*\n━━━━━━━━━━━━━━━━━━━━\n\n🎭 *Show:* ${selectedShow.title}\n💰 *Harga:* ${selectedShow.price}\n${selectedShow.schedule_date ? `📅 *Jadwal:* ${selectedShow.schedule_date} ${selectedShow.schedule_time}\n` : ""}${selectedShow.lineup ? `👥 *Lineup:* ${selectedShow.lineup}\n` : ""}\n📋 *DATA PEMBELI*\n📧 Email: ${email}\n🕐 Waktu Order: ${now}\n\n📸 *Bukti pembayaran akan dikirim menyusul*\n\n━━━━━━━━━━━━━━━━━━━━\n_Dikirim dari RealTime48_ ✨`
    );
    window.open(`https://wa.me/${settings.whatsapp_number}?text=${msg}`, "_blank");
    setSelectedShow(null);
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedShow) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) { toast({ title: "Format file tidak didukung", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File terlalu besar", variant: "destructive" }); return; }
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("show_id", selectedShow.id);
      const { data, error } = await supabase.functions.invoke("upload-payment-proof", { body: formData });
      if (error) throw error;
      if (data?.path) {
        setProofUrl(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/payment-proofs/${data.path}`);
        if (selectedShow.is_subscription) setPurchaseStep("info");
      }
    } catch { toast({ title: "Upload gagal", variant: "destructive" }); }
    setUploadingProof(false);
  };

  const handleSubmitSubscription = async () => {
    if (!selectedShow || !proofUrl) return;
    const { data: orderData } = await supabase.from("subscription_orders").insert({
      show_id: selectedShow.id, phone, email, payment_proof_url: proofUrl,
    }).select("id").single();
    setPurchaseStep("done");
    if (orderData?.id) {
      supabase.functions.invoke("notify-subscription-order", {
        body: { order_id: orderData.id, show_title: selectedShow.title, phone, email, payment_proof_url: proofUrl },
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedNavbar activePage="home" />
      <div className="mx-auto max-w-6xl px-4 py-6 pt-20">
        <div className="mb-8 flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Jadwal Show</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <img src={logo} alt="Loading" className="h-10 w-10 animate-pulse" />
          </div>
        ) : shows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">Belum ada jadwal show mendatang</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shows.map((show, i) => (
              <motion.div
                key={show.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
              >
                {/* Image */}
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
                  {/* Category badge */}
                  {show.category && show.category !== "regular" && (() => {
                    const cat = SHOW_CATEGORIES[show.category] || SHOW_CATEGORIES.regular;
                    const memberText = show.category_member && (show.category === "birthday" || show.category === "last_show")
                      ? ` — ${show.category_member}` : "";
                    return (
                      <span className={`absolute top-3 left-3 rounded-full px-3 py-1 text-[10px] font-bold backdrop-blur-sm ${cat.color}`}>
                        {cat.label}{memberText}
                      </span>
                    );
                  })()}
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-xl font-bold text-foreground">{show.title}</h3>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-3 p-4">
                  {isShowReplayMode(show) && show.replay_coin_price > 0 ? (
                    <div className="flex items-center gap-1.5 text-sm text-accent">
                      <Film className="h-4 w-4" />
                      <span className="font-semibold">Replay: {show.replay_coin_price} Koin</span>
                    </div>
                  ) : show.coin_price > 0 ? (
                    <div className="flex items-center gap-1.5 text-sm text-warning">
                      <Coins className="h-4 w-4" />
                      <span className="font-semibold">{show.coin_price} Koin</span>
                    </div>
                  ) : null}
                  <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">{show.price}</span>
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

                  {/* Action buttons - same as Index */}
                  <div className="mt-2 flex flex-col gap-2">
                    {accessPasswords[show.id] && (
                      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-center">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">🔐 Sandi Akses Show</p>
                        <p className="font-mono text-lg font-bold text-warning">{accessPasswords[show.id]}</p>
                      </div>
                    )}
                    {redeemedTokens[show.id] ? (
                      isShowReplayMode(show) ? (
                        <div className="space-y-2">
                          {(accessPasswords[show.id] || replayPasswords[show.id]) && (accessPasswords[show.id] || replayPasswords[show.id]) !== "__purchased__" && (
                            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-center">
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">🔐 Sandi Replay — salin sebelum menonton</p>
                              <p className="font-mono text-lg font-bold text-warning">{accessPasswords[show.id] || replayPasswords[show.id]}</p>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              const pw = accessPasswords[show.id] || replayPasswords[show.id];
                              if (pw && pw !== "__purchased__") {
                                navigator.clipboard.writeText(pw);
                                toast({ title: "Sandi disalin! Membuka halaman replay..." });
                                setTimeout(() => { window.open("https://replaytime.lovable.app", "_blank"); }, 500);
                              } else {
                                window.open("https://replaytime.lovable.app", "_blank");
                              }
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-accent-foreground transition-all hover:bg-accent/90"
                          >
                            <Copy className="h-4 w-4" /> {(accessPasswords[show.id] || replayPasswords[show.id]) && (accessPasswords[show.id] || replayPasswords[show.id]) !== "__purchased__" ? "Salin Sandi & Tonton Replay" : "Tonton Replay"}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/live?t=${redeemedTokens[show.id]}`);
                              toast({ title: "Link disalin!" });
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/80"
                          >
                            <Copy className="h-3.5 w-3.5" /> Salin Link Nonton
                          </button>
                        </div>
                      ) : (
                        <>
                          <a
                            href={`/live?t=${redeemedTokens[show.id]}`}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3 font-semibold text-primary-foreground transition-all hover:bg-success/90 hover:shadow-lg hover:shadow-success/25"
                          >
                            <Radio className="h-4 w-4" /> Tonton Live
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/live?t=${redeemedTokens[show.id]}`);
                              toast({ title: "Link disalin!" });
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/80"
                          >
                            <Copy className="h-3.5 w-3.5" /> Salin Link Nonton
                          </button>
                        </>
                      )
                    ) : (
                      <>
                        {show.coin_price > 0 && (
                          <button
                            onClick={() => handleCoinBuy(show)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-warning py-3 font-semibold text-warning-foreground transition-all hover:bg-warning/90 hover:shadow-lg hover:shadow-warning/25"
                          >
                            <Coins className="h-4 w-4" /> Beli dengan {show.coin_price} Koin
                          </button>
                        )}
                        <button
                          onClick={() => handleBuy(show)}
                          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold transition-all ${
                            show.coin_price > 0
                              ? "bg-muted text-muted-foreground hover:bg-muted/80"
                              : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                          }`}
                        >
                          <MessageCircle className="h-4 w-4" /> {show.coin_price > 0 ? "Beli via QRIS" : "Beli Tiket"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

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

            {!selectedShow.is_subscription && purchaseStep === "info" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    Silakan scan QRIS di bawah, lalu kirim bukti transfer secara manual ke admin via WhatsApp.
                  </p>
                </div>
                {selectedShow.qris_image_url ? (
                  <img src={selectedShow.qris_image_url} alt="QRIS" className="mx-auto w-full max-w-sm rounded-lg object-contain" />
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground">
                    QRIS belum tersedia
                  </div>
                )}
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> Email Anda
                  </label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="bg-background" />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="mb-2 text-xs font-semibold text-foreground">📋 Ringkasan Pesanan</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>🎭 {selectedShow.title}</p>
                    <p>💰 {selectedShow.price}</p>
                    {selectedShow.schedule_date && <p>📅 {selectedShow.schedule_date} {selectedShow.schedule_time}</p>}
                    {selectedShow.lineup && <p>👥 {selectedShow.lineup}</p>}
                  </div>
                </div>
                <Button
                  onClick={handleConfirmRegular}
                  disabled={!email.trim()}
                  className="w-full gap-2 bg-success hover:bg-success/90 text-primary-foreground"
                >
                  <MessageCircle className="h-4 w-4" /> Kirim Pesanan via WhatsApp
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  * Anda akan diarahkan ke WhatsApp untuk mengirim data pesanan dan bukti transfer secara manual ke admin
                </p>
              </div>
            )}

            {selectedShow.is_subscription && purchaseStep === "qris" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Silakan scan QRIS di bawah untuk melakukan pembayaran:</p>
                {selectedShow.qris_image_url ? (
                  <img src={selectedShow.qris_image_url} alt="QRIS" className="mx-auto w-full max-w-sm rounded-lg object-contain" />
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground">QRIS belum tersedia</div>
                )}
                <p className="text-xs text-muted-foreground text-center">Setelah melakukan pembayaran, upload bukti transfer:</p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-4 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10">
                  <Upload className="h-4 w-4" />
                  {uploadingProof ? "Mengupload..." : "Upload Bukti Pembayaran"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} />
                </label>
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
                <p className="text-sm text-muted-foreground">Data dan bukti pembayaran Anda telah dikirim. Admin akan mengkonfirmasi pembayaran Anda.</p>
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

      {/* Coin Purchase Dialog */}
      <Dialog open={!!coinShowTarget} onOpenChange={() => { setCoinShowTarget(null); setCoinResult(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🪙 Beli dengan Koin</DialogTitle>
            <DialogDescription>{coinShowTarget?.title}</DialogDescription>
          </DialogHeader>
          {!coinResult ? (
            <div className="space-y-4">
              {coinShowTarget?.qris_image_url && (
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground mb-2">📱 Scan QRIS untuk pembayaran</p>
                  <img src={coinShowTarget.qris_image_url} alt="QRIS" className="mx-auto max-h-48 rounded-lg object-contain" />
                </div>
              )}
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
              {coinResult.replay_password && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">🔐 Sandi Replay</p>
                  <p className="font-mono text-lg font-bold text-warning">{coinResult.replay_password}</p>
                </div>
              )}
              {coinResult.access_password && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">🔐 Sandi Akses Show</p>
                  <p className="font-mono text-lg font-bold text-primary">{coinResult.access_password}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" variant="outline"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/live?t=${coinResult.token_code}`); toast({ title: "Link disalin!" }); }}>
                  <Copy className="h-4 w-4" /> Salin Link
                </Button>
                <Button className="flex-1 gap-2" onClick={() => { window.location.href = `/live?t=${coinResult.token_code}`; }}>
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

export default SchedulePage;
