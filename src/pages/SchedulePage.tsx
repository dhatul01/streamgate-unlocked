import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SharedNavbar from "@/components/viewer/SharedNavbar";
import { Calendar } from "lucide-react";
import logo from "@/assets/logo.webp";
import type { Show } from "@/types/show";
import { useShowPurchase } from "@/hooks/useShowPurchase";
import ShowCard from "@/components/viewer/ShowCard";
import PurchaseModal from "@/components/viewer/PurchaseModal";
import CoinDialog from "@/components/viewer/CoinDialog";

const SchedulePage = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<{ whatsapp_number: string }>({ whatsapp_number: "" });

  const purchase = useShowPurchase();

  useEffect(() => {
    const fetchData = async () => {
      const [showsRes, settingsRes] = await Promise.all([
        supabase.rpc("get_public_shows"),
        supabase.from("site_settings").select("*").in("key", ["whatsapp_number"]),
      ]);
      if (showsRes.data) {
        const allShows = showsRes.data as Show[];
        const upcoming = allShows.filter(s => {
          if (s.is_subscription) return false;
          if (!s.schedule_date) return false;
          if (s.is_replay) return false;
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

    const showCh = supabase.channel("sched-shows")
      .on("postgres_changes", { event: "*", schema: "public", table: "shows" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(showCh); };
  }, []);

  const handleConfirmRegular = () => {
    if (!purchase.selectedShow || !settings.whatsapp_number) return;
    const now = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
    const show = purchase.selectedShow;
    const msg = encodeURIComponent(
      `━━━━━━━━━━━━━━━━━━━━\n🎬 *PESANAN TIKET BARU*\n━━━━━━━━━━━━━━━━━━━━\n\n🎭 *Show:* ${show.title}\n💰 *Harga:* ${show.price}\n${show.schedule_date ? `📅 *Jadwal:* ${show.schedule_date} ${show.schedule_time}\n` : ""}${show.lineup ? `👥 *Lineup:* ${show.lineup}\n` : ""}\n📋 *DATA PEMBELI*\n📧 Email: ${purchase.email}\n🕐 Waktu Order: ${now}\n\n📸 *Bukti pembayaran akan dikirim menyusul*\n\n━━━━━━━━━━━━━━━━━━━━\n_Dikirim dari RealTime48_ ✨`
    );
    window.open(`https://wa.me/${settings.whatsapp_number}?text=${msg}`, "_blank");
    purchase.setSelectedShow(null);
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
              <ShowCard
                key={show.id}
                show={show}
                index={i}
                isReplayMode={show.is_replay}
                redeemedToken={purchase.redeemedTokens[show.id]}
                accessPassword={purchase.accessPasswords[show.id]}
                replayPassword={purchase.replayPasswords[show.id]}
                onBuy={purchase.handleBuy}
                onCoinBuy={purchase.handleCoinBuy}
              />
            ))}
          </div>
        )}
      </div>

      {purchase.selectedShow && (
        <PurchaseModal
          show={purchase.selectedShow}
          purchaseStep={purchase.purchaseStep}
          uploadingProof={purchase.uploadingProof}
          phone={purchase.phone}
          setPhone={purchase.setPhone}
          email={purchase.email}
          setEmail={purchase.setEmail}
          onClose={() => purchase.setSelectedShow(null)}
          onConfirmRegular={handleConfirmRegular}
          onUploadProof={purchase.handleUploadProof}
          onSubmitSubscription={purchase.handleSubmitSubscription}
        />
      )}

      <CoinDialog
        show={purchase.coinShowTarget}
        coinBalance={purchase.coinBalance}
        coinRedeeming={purchase.coinRedeeming}
        coinResult={purchase.coinResult}
        onClose={() => { purchase.setCoinShowTarget(null); purchase.setCoinResult(null); }}
        onRedeem={purchase.handleCoinRedeem}
      />
    </div>
  );
};

export default SchedulePage;
