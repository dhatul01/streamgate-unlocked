import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { Coins, Upload, CheckCircle, LogOut, ArrowLeft, Ticket, Copy, Sparkles, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import SharedNavbar from "@/components/viewer/SharedNavbar";

interface CoinPackage { id: string; name: string; coin_amount: number; price: number; qris_image_url: string | null; }
interface Show { id: string; title: string; coin_price: number; schedule_date: string; schedule_time: string; background_image_url: string | null; is_active: boolean; }

const CoinShop = () => {
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"buy" | "redeem" | "history">("buy");
  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<"phone" | "qris" | "upload" | "done">("phone");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [uploading, setUploading] = useState(false);
  const [redeemingShow, setRedeemingShow] = useState<string | null>(null);
  const [redeemResult, setRedeemResult] = useState<{ token_code: string; remaining_balance: number } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUser(user);

      // Get username from profiles
      const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      setUsername(profile?.username || user.user_metadata?.username || "User");

      await fetchData(user.id);
      setLoading(false);
    };
    init();
  }, [navigate]);

  // Realtime coin balance & transactions updates
  useEffect(() => {
    if (!user) return;

    const balChannel = supabase
      .channel(`coinshop-balance-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coin_balances", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        if (payload.new?.balance !== undefined) setBalance(payload.new.balance);
      })
      .subscribe();

    const txChannel = supabase
      .channel(`coinshop-transactions-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "coin_transactions", filter: `user_id=eq.${user.id}` }, () => {
        fetchData(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(balChannel);
      supabase.removeChannel(txChannel);
    };
  }, [user]);

  const fetchData = async (userId: string) => {
    const [balRes, pkgRes, txRes] = await Promise.all([
      supabase.from("coin_balances").select("balance").eq("user_id", userId).maybeSingle(),
      supabase.from("coin_packages").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("coin_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    setBalance(balRes.data?.balance || 0);
    setPackages(pkgRes.data || []);
    setTransactions(txRes.data || []);

    const { data: showsData } = await supabase.rpc("get_public_shows");
    const coinShows = (showsData || []).filter((s: any) => s.coin_price > 0 && s.is_active);
    setShows(coinShows as any);
  };

  const handleBuyPackage = (pkg: CoinPackage) => { setSelectedPkg(pkg); setPurchaseStep("phone"); setBuyerPhone(""); };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast({ title: "Format tidak didukung", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File terlalu besar (maks 5MB)", variant: "destructive" }); return; }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "coin");

    console.log("Uploading payment proof for coin order...");
    const { data, error } = await supabase.functions.invoke("upload-payment-proof", { body: formData });
    console.log("Upload result:", { data, error });
    if (error || !data?.path) { 
      console.error("Upload failed:", error, data);
      toast({ title: "Upload gagal", description: error?.message || "Coba lagi", variant: "destructive" }); 
      setUploading(false); 
      return; 
    }

    setUploading(false);
    setPurchaseStep("done");

    console.log("Inserting coin order...");
    const { data: orderData, error: insertError } = await supabase.from("coin_orders").insert({
      user_id: user.id, package_id: selectedPkg!.id,
      coin_amount: selectedPkg!.coin_amount, price: selectedPkg!.price,
      payment_proof_url: data.path, status: "pending",
      phone: buyerPhone.trim(),
    }).select("id").single();
    console.log("Insert result:", { orderData, insertError });
    
    if (insertError) {
      console.error("Insert coin order failed:", insertError);
      toast({ title: "Order gagal disimpan", description: insertError.message, variant: "destructive" });
      return;
    }
    
    toast({ title: "Order terkirim!", description: "Menunggu konfirmasi admin." });

    // Send WhatsApp notification to admin
    if (orderData?.id) {
      supabase.functions.invoke("notify-coin-order", {
        body: {
          order_id: orderData.id,
          username: username || "User",
          package_name: selectedPkg!.name,
          coin_amount: selectedPkg!.coin_amount,
          price: selectedPkg!.price,
          payment_proof_url: data.path,
        },
      }).catch(() => {});
    }
  };

  const handleRedeem = async (showId: string) => {
    setRedeemingShow(showId);
    const { data, error } = await supabase.rpc("redeem_coins_for_token", { _show_id: showId });
    const result = data as any;
    if (error || !result?.success) {
      toast({ title: "Gagal menukar koin", description: result?.error || error?.message, variant: "destructive" });
      setRedeemingShow(null); return;
    }
    setRedeemResult({ token_code: result.token_code, remaining_balance: result.remaining_balance });
    setBalance(result.remaining_balance);
    setRedeemingShow(null);
  };

  const copyToken = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/live?t=${code}`);
    toast({ title: "Link disalin!" });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };
  const formatPrice = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><img src={logo} alt="Loading" className="h-12 w-12 animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <SharedNavbar activePage="coins" />

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex gap-2">
          {([{ key: "buy" as const, label: "Beli Koin", icon: Coins }, { key: "redeem" as const, label: "Tukar Koin", icon: Ticket }, { key: "history" as const, label: "Riwayat", icon: Sparkles }]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "buy" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">🪙 Pilih Paket Koin</h2>
            {packages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada paket tersedia</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {packages.map((pkg) => (
                <motion.div key={pkg.id} whileHover={{ scale: 1.02 }} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2"><Coins className="h-5 w-5 text-warning" /><span className="text-lg font-bold text-foreground">{pkg.coin_amount} Koin</span></div>
                  <p className="mb-1 text-sm font-semibold text-primary">{formatPrice(pkg.price)}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{pkg.name}</p>
                  <Button size="sm" className="w-full" onClick={() => handleBuyPackage(pkg)}>Beli Sekarang</Button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {tab === "redeem" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">🎟️ Tukar Koin untuk Akses Show</h2>
            {shows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada show tersedia</p>}
            {shows.map((show) => (
              <div key={show.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-semibold text-foreground">{show.title}</p>
                  <p className="text-xs text-muted-foreground">{show.schedule_date} · {show.schedule_time}</p>
                  <div className="mt-1 flex items-center gap-1 text-sm font-bold text-warning"><Coins className="h-3.5 w-3.5" /> {show.coin_price} Koin</div>
                </div>
                <Button size="sm" disabled={balance < show.coin_price || redeemingShow === show.id} onClick={() => handleRedeem(show.id)}>
                  {redeemingShow === show.id ? "..." : balance < show.coin_price ? "Koin Kurang" : "Tukar"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">📜 Riwayat Transaksi</h2>
            {transactions.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada transaksi</p>}
            {transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div><p className="text-sm font-medium text-foreground">{tx.description}</p><p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString("id-ID")}</p></div>
                <span className={`text-sm font-bold ${tx.amount > 0 ? "text-success" : "text-destructive"}`}>{tx.amount > 0 ? "+" : ""}{tx.amount}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => navigate("/")} className="mt-8 flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Kembali ke Beranda</button>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={!!selectedPkg} onOpenChange={() => setSelectedPkg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Beli {selectedPkg?.coin_amount} Koin</DialogTitle><DialogDescription>{formatPrice(selectedPkg?.price || 0)}</DialogDescription></DialogHeader>
          {purchaseStep === "phone" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Masukkan nomor WhatsApp untuk notifikasi status order</p>
              <Input
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="bg-background"
              />
              <Button className="w-full" disabled={!buyerPhone.trim() || buyerPhone.trim().length < 10} onClick={() => setPurchaseStep(selectedPkg?.qris_image_url ? "qris" : "upload")}>
                Lanjut →
              </Button>
            </div>
          )}
          {purchaseStep === "qris" && selectedPkg?.qris_image_url && (
            <div className="space-y-3">
              <img src={selectedPkg.qris_image_url} alt="QRIS" className="mx-auto w-64 rounded-lg" />
              <p className="text-center text-xs text-muted-foreground">Scan QRIS lalu upload bukti bayar</p>
              <Button className="w-full" onClick={() => setPurchaseStep("upload")}>Sudah Bayar → Upload Bukti</Button>
            </div>
          )}
          {purchaseStep === "upload" && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 hover:border-primary">
                <Upload className={`h-8 w-8 ${uploading ? "animate-pulse text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm text-muted-foreground">{uploading ? "Mengupload..." : "Tap untuk upload bukti bayar"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} disabled={uploading} />
              </label>
            </div>
          )}
          {purchaseStep === "done" && (
            <div className="space-y-3 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success" />
              <p className="font-semibold text-foreground">Order Terkirim!</p>
              <p className="text-sm text-muted-foreground">Koin akan ditambahkan setelah admin konfirmasi.</p>
              <Button className="w-full" onClick={() => setSelectedPkg(null)}>Tutup</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Redeem Result */}
      <Dialog open={!!redeemResult} onOpenChange={() => setRedeemResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>🎉 Token Berhasil!</DialogTitle><DialogDescription>Gunakan token ini untuk menonton</DialogDescription></DialogHeader>
          {redeemResult && (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-secondary p-4"><p className="font-mono text-lg font-bold text-primary">{redeemResult.token_code}</p></div>
              <Button className="w-full gap-2" onClick={() => copyToken(redeemResult.token_code)}><Copy className="h-4 w-4" /> Salin Link Nonton</Button>
              <p className="text-xs text-muted-foreground">Sisa saldo: <span className="font-bold text-warning">{redeemResult.remaining_balance} koin</span></p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoinShop;
