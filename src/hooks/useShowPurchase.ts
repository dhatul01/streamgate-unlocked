import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Show } from "@/types/show";

export function useShowPurchase() {
  const { toast } = useToast();

  // Purchase modal state
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<"qris" | "upload" | "info" | "done">("info");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

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
        const validMap: Record<string, string> = {};

        for (const [showId, tokenCode] of Object.entries(mergedTokens)) {
          const { data } = await supabase.rpc("validate_token", { _code: tokenCode as string });
          if ((data as any)?.valid) validMap[showId] = tokenCode as string;
        }

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
    // Coin
    coinUser, coinBalance, coinUsername, coinShowTarget, setCoinShowTarget,
    coinRedeeming, coinResult, setCoinResult, handleCoinBuy, handleCoinRedeem,
    // Token/password maps
    redeemedTokens, replayPasswords, accessPasswords,
  };
}
