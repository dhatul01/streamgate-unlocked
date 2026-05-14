import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Coins, Film, Phone, Radio, Ticket } from "lucide-react";
import logo from "@/assets/logo.webp";
import LandingFloatingEmojis from "@/components/viewer/LandingFloatingEmojis";
import type { Show } from "@/types/show";
import PasswordResetBanner from "@/components/viewer/PasswordResetBanner";
import ShowTimezoneStrip from "@/components/viewer/ShowTimezoneStrip";
import LandingStats from "@/components/viewer/LandingStats";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import AnnouncementBanner from "@/components/landing/AnnouncementBanner";
import DescriptionsSection from "@/components/landing/DescriptionsSection";
import SubscriptionsSection from "@/components/landing/SubscriptionsSection";
import ShowsSection from "@/components/landing/ShowsSection";
import PurchaseDialog, { type PurchaseStep, type PakasirData, type PakasirResult } from "@/components/landing/PurchaseDialog";
import CoinPurchaseDialog, { type CoinResult } from "@/components/landing/CoinPurchaseDialog";
import ReplayPasswordDialog from "@/components/landing/ReplayPasswordDialog";
import type { LandingDescription, SiteSettings, MenuItem } from "@/components/landing/types";

const Index = () => {
  const { toast } = useToast();
  const [shows, setShows] = useState<Show[]>([]);
  const [loadingShows, setLoadingShows] = useState(true);
  const [showsError, setShowsError] = useState<string | null>(null);
  const [isStreamLive, setIsStreamLive] = useState(true);
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
    announcement_text: "",
    announcement_enabled: "",
  });
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<"qris" | "upload" | "info" | "done" | "pakasir_qr" | "pakasir_done">("qris");
  const [pakasirLoading, setPakasirLoading] = useState(false);
  const [pakasirData, setPakasirData] = useState<{ qr_string: string; total_payment: number; expires_at: string; order_id: string } | null>(null);
  const [pakasirResult, setPakasirResult] = useState<{ token_code: string; show_title: string } | null>(null);
  const [pakasirError, setPakasirError] = useState<string | null>(null);
  const [pakasirAttempts, setPakasirAttempts] = useState(0);
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
  const [coinResult, setCoinResult] = useState<{ token_code: string; remaining_balance: number; replay_password?: string; access_password?: string } | null>(null);
  // Map of show_id -> { token_code, replay_password } for shows redeemed by this user
  const [redeemedTokens, setRedeemedTokens] = useState<Record<string, string>>({});
  const [replayPasswords, setReplayPasswords] = useState<Record<string, string>>({});
  const [accessPasswords, setAccessPasswords] = useState<Record<string, string>>({});
  const [replayModal, setReplayModal] = useState<{ showId: string; password: string } | null>(null);
  const [replayCopied, setReplayCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchData = async () => {
    setShowsError(null);
    try {
      const [showsRes, settingsRes, descRes, streamRes] = await Promise.all([
        supabase.rpc("get_public_shows"),
        supabase.from("site_settings").select("*"),
        supabase.from("landing_descriptions").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("streams").select("is_live").limit(1).single(),
      ]);
      if (showsRes.error) throw showsRes.error;
      if (streamRes.data) {
        setIsStreamLive(streamRes.data.is_live);
      }
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
    } catch (err: any) {
      console.error("[Index] fetchData failed:", err);
      setShowsError(err?.message || "Gagal memuat daftar show. Periksa koneksi internet Anda.");
    } finally {
      setLoadingShows(false);
    }
  };

  const handleRetryShows = () => {
    setLoadingShows(true);
    fetchData();
  };

  // Helper: check if show scheduled time has already passed
  const isShowPastSchedule = (show: Show) => {
    if (!show.schedule_date || !show.schedule_time) return false;
    try {
      const timeStr = show.schedule_time.replace(/\s*WIB\s*/i, "").trim();
      const dateTimeStr = `${show.schedule_date} ${timeStr}`;
      const showDate = new Date(dateTimeStr);
      if (isNaN(showDate.getTime())) return false;
      return new Date() > showDate;
    } catch {
      return false;
    }
  };

  // Helper: check if show is past 2 hours from schedule
  const isShowPast2Hours = (show: Show) => {
    if (!show.schedule_date || !show.schedule_time) return false;
    try {
      const timeStr = show.schedule_time.replace(/\s*WIB\s*/i, "").trim();
      const dateTimeStr = `${show.schedule_date} ${timeStr}`;
      const showDate = new Date(dateTimeStr);
      if (isNaN(showDate.getTime())) return false;
      const twoHoursAfter = new Date(showDate.getTime() + 2 * 60 * 60 * 1000);
      return new Date() > twoHoursAfter;
    } catch {
      return false;
    }
  };

  // Helper: check if show is past 4 hours (move to replay page)
  const isShowPast4Hours = (show: Show) => {
    if (!show.schedule_date || !show.schedule_time) return false;
    try {
      const timeStr = show.schedule_time.replace(/\s*WIB\s*/i, "").trim();
      const dateTimeStr = `${show.schedule_date} ${timeStr}`;
      const showDate = new Date(dateTimeStr);
      if (isNaN(showDate.getTime())) return false;
      return new Date() > new Date(showDate.getTime() + 4 * 60 * 60 * 1000);
    } catch {
      return false;
    }
  };

  // A show is in "replay mode" only when admin manually sets is_replay
  const isShowReplayMode = (show: Show) => {
    return show.is_replay;
  };

  useEffect(() => {
    fetchData();

    // Fetch coin user & balance & redeemed tokens
    const fetchCoinUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        const hasSeenPrompt = sessionStorage.getItem("login_prompt_shown");
        if (!hasSeenPrompt) {
          sessionStorage.setItem("login_prompt_shown", "1");
          toast({
            title: "👋 Selamat datang!",
            description: "Login atau daftar untuk menikmati fitur lengkap.",
            duration: 4000,
          });
        }
        return;
      }
      if (user) {
        setCoinUser(user);
        const [balRes, profileRes] = await Promise.all([
          supabase.from("coin_balances").select("balance").eq("user_id", user.id).maybeSingle(),
          supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
        ]);
        setCoinBalance(balRes.data?.balance || 0);
        setCoinUsername(profileRes.data?.username || user.user_metadata?.username || "");

        try {
          const stored = JSON.parse(localStorage.getItem(`redeemed_tokens_${user.id}`) || "{}");
          const { data: tokenData } = await supabase.rpc("get_my_active_show_tokens");
          const backendTokens = tokenData && typeof tokenData === "object" ? (tokenData as Record<string, string>) : {};
          const mergedTokens = { ...stored, ...backendTokens };
          const validMap: Record<string, string> = {};

          for (const [showId, tokenCode] of Object.entries(mergedTokens)) {
            const { data } = await supabase.rpc("validate_token", { _code: tokenCode as string });
            if ((data as any)?.valid) {
              validMap[showId] = tokenCode as string;
            }
          }

          localStorage.setItem(`redeemed_tokens_${user.id}`, JSON.stringify(validMap));
          setRedeemedTokens(validMap);
        } catch {}

        try {
          const storedPw = JSON.parse(localStorage.getItem(`replay_passwords_${user.id}`) || "{}");
          setReplayPasswords(storedPw);
        } catch {}

        try {
          const storedAp = JSON.parse(localStorage.getItem(`access_passwords_${user.id}`) || "{}");
          setAccessPasswords(storedAp);
        } catch {}

        try {
          const { data: pwData } = await supabase.rpc("get_purchased_show_passwords");
          if (pwData && typeof pwData === "object") {
            const pwMap = pwData as Record<string, string>;
            const storedAp = JSON.parse(localStorage.getItem(`access_passwords_${user.id}`) || "{}");
            const merged = { ...storedAp, ...pwMap };
            localStorage.setItem(`access_passwords_${user.id}`, JSON.stringify(merged));
            setAccessPasswords(merged);
          }
        } catch {}

        // Subscribe to balance changes for toast notification
        const balCh = supabase
          .channel(`idx-balance-${user.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "coin_balances", filter: `user_id=eq.${user.id}` }, (payload: any) => {
            if (payload.new?.balance !== undefined) {
              const oldBal = payload.old?.balance ?? 0;
              const newBal = payload.new.balance;
              setCoinBalance(newBal);
              if (newBal > oldBal) {
                toast({ title: "💰 Koin Ditambahkan!", description: `+${newBal - oldBal} koin telah masuk ke akunmu. Saldo: ${newBal} koin` });
              }
            }
          })
          .subscribe();

        return () => { supabase.removeChannel(balCh); };
      }
    };
    const cleanupBalance = fetchCoinUser();

    // Realtime for shows, orders, and stream status
    const showCh = supabase.channel("idx-shows")
      .on("postgres_changes", { event: "*", schema: "public", table: "shows" }, () => fetchData())
      .subscribe();
    const orderCh = supabase.channel("idx-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscription_orders" }, () => fetchData())
      .subscribe();
    const streamCh = supabase.channel("idx-streams")
      .on("postgres_changes", { event: "*", schema: "public", table: "streams" }, (payload: any) => {
        if (payload.new?.is_live !== undefined) {
          setIsStreamLive(payload.new.is_live);
        }
      })
      .subscribe();

    // Polling fallback: re-fetch is_live every 30s in case realtime is delayed/disconnected
    const pollLive = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.from("streams").select("is_live").limit(1).single();
      if (data && typeof data.is_live === "boolean") {
        setIsStreamLive((prev) => (prev !== data.is_live ? data.is_live : prev));
      }
    };
    const livePollId = window.setInterval(pollLive, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") pollLive(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(showCh);
      supabase.removeChannel(orderCh);
      supabase.removeChannel(streamCh);
      window.clearInterval(livePollId);
      document.removeEventListener("visibilitychange", onVisible);
      cleanupBalance.then((cleanup) => cleanup?.());
    };
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

  const handleCoinRedeem = async (phoneInput?: string) => {
    if (!coinShowTarget) return;
    const cleanPhone = (phoneInput || "").replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      toast({ title: "Nomor WhatsApp tidak valid", description: "Masukkan nomor WhatsApp aktif untuk menerima token.", variant: "destructive" });
      return;
    }
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

    // Save redeemed token + replay password + access password to localStorage
    if (coinUser) {
      const stored = JSON.parse(localStorage.getItem(`redeemed_tokens_${coinUser.id}`) || "{}");
      stored[coinShowTarget.id] = result.token_code;
      localStorage.setItem(`redeemed_tokens_${coinUser.id}`, JSON.stringify(stored));
      setRedeemedTokens((prev) => ({ ...prev, [coinShowTarget.id]: result.token_code }));

      if (result.replay_password) {
        const storedPw = JSON.parse(localStorage.getItem(`replay_passwords_${coinUser.id}`) || "{}");
        storedPw[coinShowTarget.id] = result.replay_password;
        localStorage.setItem(`replay_passwords_${coinUser.id}`, JSON.stringify(storedPw));
        setReplayPasswords((prev) => ({ ...prev, [coinShowTarget.id]: result.replay_password }));
      }

      if (result.access_password) {
        const storedAp = JSON.parse(localStorage.getItem(`access_passwords_${coinUser.id}`) || "{}");
        storedAp[coinShowTarget.id] = result.access_password;
        localStorage.setItem(`access_passwords_${coinUser.id}`, JSON.stringify(storedAp));
        setAccessPasswords((prev) => ({ ...prev, [coinShowTarget.id]: result.access_password }));
      }
    }

    // WhatsApp notification with token + replay info
    try {
      const liveLink = `${window.location.origin}/live?t=${result.token_code}`;
      const lines = [
        `🎟️ *Pembelian Show Berhasil!*`,
        ``,
        `🎭 Show: *${coinShowTarget.title}*`,
        coinShowTarget.schedule_date ? `📅 Jadwal: ${coinShowTarget.schedule_date} ${coinShowTarget.schedule_time || ""}`.trim() : "",
        ``,
        `🔑 Token: *${result.token_code}*`,
        `🔗 Link Live: ${liveLink}`,
        result.access_password ? `🔐 Sandi Akses Show: *${result.access_password}*` : "",
        result.replay_password ? `🎬 Sandi Replay: *${result.replay_password}* (gunakan untuk akses replay setelah show selesai)` : "",
        ``,
        `Tombol *Tonton Live* aktif 2 jam sebelum show dimulai. Simpan pesan ini ya!`,
      ].filter(Boolean);
      await supabase.functions.invoke("send-whatsapp", {
        body: { target: cleanPhone, message: lines.join("\n"), type: "coin_purchase" },
      });
      toast({ title: "📲 Token dikirim ke WhatsApp", description: `Cek nomor ${cleanPhone}.` });
    } catch (e) {
      console.warn("WA notify failed", e);
    }
  };


  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedShow) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/heic", "image/heif"];
    if (file.type && !allowedTypes.includes(file.type.toLowerCase()) && !file.type.startsWith("image/")) {
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

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-payment-proof`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.path) {
        toast({ title: "Upload gagal", description: data?.error || "Coba lagi", variant: "destructive" });
        setUploadingProof(false);
        return;
      }
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

  const handleConfirmRegular = async () => {
    if (!selectedShow) return;
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 8) {
      toast({ title: "Nomor WhatsApp tidak valid", variant: "destructive" });
      return;
    }
    const amount = parseInt((selectedShow.price || "").replace(/[^0-9]/g, ""), 10) || 0;
    if (amount < 1000) {
      toast({
        title: "Harga belum valid untuk QRIS Pakasir",
        description: "Atur harga show minimal Rp 1.000 agar QRIS dinamis bisa dibuat.",
        variant: "destructive",
      });
      return;
    }
    setPakasirLoading(true);
    setPakasirError(null);
    setPakasirAttempts((n) => n + 1);
    setPakasirData(null);
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pakasir-create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ show_id: selectedShow.id, phone: cleanPhone, email }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.qr_string) {
        throw new Error(data?.error || `QRIS belum bisa dibuat (HTTP ${res.status})`);
      }
      setPakasirData({ qr_string: data.qr_string, total_payment: data.total_payment, expires_at: data.expires_at, order_id: data.order_id });
      setPurchaseStep("pakasir_qr");
      setPakasirError(null);
      const showTitle = selectedShow.title;
      const start = Date.now();
      const tick = async () => {
        if (Date.now() - start > 30 * 60 * 1000) return;
        try {
          const { data: s } = await supabase.rpc("get_pakasir_order_status", { _order_id: data.order_id });
          const r = s as any;
          if (r?.status === "completed" && r?.token_code) {
            setPakasirResult({ token_code: r.token_code, show_title: showTitle });
            setPurchaseStep("pakasir_done");
            toast({ title: "✅ Pembayaran terkonfirmasi", description: "Token telah dikirim ke WhatsApp Anda." });
            return;
          }
        } catch {}
        setTimeout(tick, 4000);
      };
      setTimeout(tick, 4000);
    } catch (e: any) {
      const msg = e?.name === "AbortError"
        ? "Timeout membuat QRIS. Coba lagi."
        : (e?.message || "Gagal terhubung ke gateway pembayaran.");
      setPakasirError(msg);
      toast({ title: "QRIS gagal dibuat", description: msg, variant: "destructive" });
    }
    setPakasirLoading(false);
  };

  const regularShows = shows.filter((s) => !s.is_subscription && !isShowReplayMode(s));
  const replayShows = shows.filter((s) => !s.is_subscription && isShowReplayMode(s) && s.replay_coin_price > 0);
  const subscriptionShows = shows.filter((s) => s.is_subscription);

  const menuItems = [
    {
      icon: <Film className="h-5 w-5 tv:h-7 tv:w-7 text-accent" />,
      label: "Replay Show",
      description: "Tonton ulang show yang sudah berlalu",
      action: () => { window.location.href = "/replay"; },
    },
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

      <LandingNavbar
        sheetOpen={sheetOpen}
        onSheetOpenChange={setSheetOpen}
        coinUser={coinUser}
        coinUsername={coinUsername}
        coinBalance={coinBalance}
        menuItems={menuItems}
      />

      <div className="relative z-30 mx-auto max-w-6xl px-4 pt-20">
        <PasswordResetBanner />
      </div>

      <HeroSection heroVideoUrl={settings.hero_video_url} siteTitle={settings.site_title} />

      <AnnouncementBanner
        enabled={settings.announcement_enabled === "true"}
        text={settings.announcement_text}
      />

      <DescriptionsSection descriptions={descriptions} settings={settings} />

      <SubscriptionsSection
        subscriptionShows={subscriptionShows}
        subscriberCounts={subscriberCounts}
      />

      <section className="px-4 pb-2 pt-6">
        <ShowTimezoneStrip />
      </section>
      <section className="px-4 py-8 md:py-10">
        <LandingStats />
      </section>

      <ShowsSection
        loading={loadingShows}
        error={showsError}
        regularShows={regularShows}
        settings={settings}
        redeemedTokens={redeemedTokens}
        accessPasswords={accessPasswords}
        replayPasswords={replayPasswords}
        isShowReplayMode={isShowReplayMode}
        onBuy={handleBuy}
        onCoinBuy={handleCoinBuy}
        onRetry={handleRetryShows}
      />

      <footer className="border-t border-border px-4 py-8 tv:py-12 text-center">
        <div className="flex items-center justify-center gap-2 tv:gap-3">
          <img src={logo} alt="RealTime48" className="h-6 w-6 tv:h-10 tv:w-10 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" />
          <span className="text-sm font-semibold text-foreground tv:text-xl">Real<span className="text-primary">Time48</span></span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground tv:text-base">Secure Streaming Platform</p>
      </footer>

      <PurchaseDialog
        selectedShow={selectedShow}
        onClose={() => setSelectedShow(null)}
        purchaseStep={purchaseStep}
        pakasirData={pakasirData}
        pakasirResult={pakasirResult}
        pakasirLoading={pakasirLoading}
        pakasirError={pakasirError}
        pakasirAttempts={pakasirAttempts}
        onPakasirRetry={handleConfirmRegular}
        uploadingProof={uploadingProof}
        phone={phone}
        setPhone={setPhone}
        email={email}
        setEmail={setEmail}
        onConfirmRegular={handleConfirmRegular}
        onUploadProof={handleUploadProof}
        onSubmitSubscription={handleSubmitSubscription}
      />

      <CoinPurchaseDialog
        coinShowTarget={coinShowTarget}
        onClose={() => { setCoinShowTarget(null); setCoinResult(null); }}
        coinResult={coinResult}
        coinBalance={coinBalance}
        coinRedeeming={coinRedeeming}
        onRedeem={handleCoinRedeem}
      />

      <ReplayPasswordDialog
        replayModal={replayModal}
        onClose={() => setReplayModal(null)}
      />
    </div>
  );
};

export default Index;
