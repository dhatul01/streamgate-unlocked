import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Show } from "@/types/show";

export function useShowPurchase() {
  const { toast } = useToast();

  // Purchase modal state
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<"qris" | "upload" | "info" | "done" | "pakasir_qr" | "pakasir_done">("info");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Pakasir state
  const [pakasirLoading, setPakasirLoading] = useState(false);
  const [pakasirData, setPakasirData] = useState<{ qr_string: string; total_payment: number; expires_at: string; order_id: string } | null>(null);
  const [pakasirResult, setPakasirResult] = useState<{ token_code: string; show_title: string } | null>(null);
  const [pakasirError, setPakasirError] = useState<string | null>(null);
  const [pakasirAttempts, setPakasirAttempts] = useState(0);

  // Coin state
  const [coinUser, setCoinUser] = useState<any>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [coinUsername, setCoinUsername] = useState("");
  const [coinShowTarget, setCoinShowTarget] = useState<Show | null>(null);
  const [coinRedeeming, setCoinRedeeming] = useState(false);
  const [coinResult, setCoinResult] = useState<{
    token_code: string;
    remaining_balance: number;
    replay_password?: string;
    access_password?: string;
  } | null>(null);
  const [redeemedTokens, setRedeemedTokens] = useState<Record<string, string>>({});
  const [replayPasswords, setReplayPasswords] = useState<Record<string, string>>({});
  const [accessPasswords, setAccessPasswords] = useState<Record<string, string>>({});

  useEffect(() => {
    let balChannel: any;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const user = session.user;
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

        // Validate all tokens in parallel instead of sequentially
        const entries = Object.entries(mergedTokens);
        const results = await Promise.all(
          entries.map(([, tokenCode]) =>
            supabase.rpc("validate_token", { _code: tokenCode as string }).then(r => r.data)
          )
        );
        const validMap: Record<string, string> = {};
        entries.forEach(([showId, tokenCode], i) => {
          if ((results[i] as any)?.valid) validMap[showId] = tokenCode as string;
        });

        localStorage.setItem(`redeemed_tokens_${user.id}`, JSON.stringify(validMap));
        setRedeemedTokens(validMap);
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

      // Realtime balance
      balChannel = supabase
        .channel(`purchase-balance-${user.id}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "coin_balances",
          filter: `user_id=eq.${user.id}`,
        }, (payload: any) => {
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
    };
    init();
    return () => { if (balChannel) supabase.removeChannel(balChannel); };
  }, []);

  const handleBuy = (show: Show) => {
    setSelectedShow(show);
    setPurchaseStep(show.is_subscription ? "qris" : "info");
    setProofUrl(""); setPhone(""); setEmail("");
    setPakasirData(null); setPakasirResult(null); setPakasirLoading(false);
    setPakasirError(null); setPakasirAttempts(0);
  };

  // Pakasir flow for non-membership shows
  const handlePakasirCreate = async () => {
    if (!selectedShow) return;
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 8) {
      toast({ title: "Nomor HP tidak valid", variant: "destructive" });
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
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pakasir-create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ show_id: selectedShow.id, phone: cleanPhone, email }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.qr_string) {
        throw new Error(data?.error || `QRIS belum bisa dibuat (HTTP ${res.status})`);
      }
      setPakasirData({
        qr_string: data.qr_string,
        total_payment: data.total_payment,
        expires_at: data.expires_at,
        order_id: data.order_id,
      });
      setPurchaseStep("pakasir_qr");
      setPakasirError(null);
      // Start polling
      pollPakasirOrder(data.order_id, selectedShow.title);
    } catch (e: any) {
      const msg = e?.name === "AbortError"
        ? "Timeout membuat QRIS. Coba lagi."
        : (e?.message || "Gagal terhubung ke gateway pembayaran.");
      setPakasirError(msg);
      toast({ title: "QRIS gagal dibuat", description: msg, variant: "destructive" });
    }
    setPakasirLoading(false);
  };

  const handlePakasirRetry = async () => {
    setPakasirData(null);
    setPakasirError(null);
    await handlePakasirCreate();
  };

  const pollPakasirOrder = async (orderId: string, showTitle: string) => {
    const start = Date.now();
    const maxMs = 30 * 60 * 1000; // 30 menit
    let verifyTick = 0;
    const tick = async () => {
      if (Date.now() - start > maxMs) return;
      try {
        // Ask backend to actively verify against Pakasir API every cycle.
        // This handles cases where the Pakasir webhook didn't fire/was lost.
        verifyTick++;
        try {
          await supabase.functions.invoke("pakasir-verify-payment", {
            body: { order_id: orderId },
          });
        } catch { /* fall back to status check */ }

        const { data } = await supabase.rpc("get_pakasir_order_status", { _order_id: orderId });
        const r = data as any;
        if (r?.status === "completed" && r?.token_code) {
          setPakasirResult({ token_code: r.token_code, show_title: showTitle });
          setPurchaseStep("pakasir_done");
          toast({ title: "✅ Pembayaran terkonfirmasi", description: "Token telah dikirim ke WhatsApp Anda." });
          return;
        }
      } catch {}
      const interval = verifyTick < 30 ? 4000 : 8000;
      setTimeout(tick, interval);
    };
    setTimeout(tick, 3000);
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
    setCoinResult({
      token_code: result.token_code,
      remaining_balance: result.remaining_balance,
      replay_password: result.replay_password,
      access_password: result.access_password,
    });
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

    // Send WhatsApp notification with token + replay info
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
      // non-fatal
      console.warn("WA notify failed", e);
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedShow) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/heic", "image/heif"];
    if (file.type && !allowedTypes.includes(file.type.toLowerCase()) && !file.type.startsWith("image/")) {
      toast({ title: "Format file tidak didukung", variant: "destructive" }); return;
    }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File terlalu besar", variant: "destructive" }); return; }
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
        throw new Error(data?.error || "Upload gagal");
      }
      setProofUrl(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/payment-proofs/${data.path}`);
      if (selectedShow.is_subscription) setPurchaseStep("info");
    } catch (err: any) {
      toast({ title: "Upload gagal", description: err?.message || "Coba lagi", variant: "destructive" });
    }
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

  return {
    // Purchase modal
    selectedShow, setSelectedShow, purchaseStep, setPurchaseStep,
    uploadingProof, proofUrl, phone, setPhone, email, setEmail,
    handleBuy, handleUploadProof, handleSubmitSubscription,
    // Pakasir
    pakasirLoading, pakasirData, pakasirResult, handlePakasirCreate,
    pakasirError, pakasirAttempts, handlePakasirRetry,
    // Coin
    coinUser, coinBalance, coinUsername, coinShowTarget, setCoinShowTarget,
    coinRedeeming, coinResult, setCoinResult, handleCoinBuy, handleCoinRedeem,
    // Token/password maps
    redeemedTokens, replayPasswords, accessPasswords,
  };
}
