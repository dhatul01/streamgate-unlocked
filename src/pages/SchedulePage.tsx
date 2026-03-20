import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SharedNavbar from "@/components/viewer/SharedNavbar";
import { Calendar, Clock, Ticket, Timer } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";

interface ScheduleShow {
  id: string;
  title: string;
  schedule_date: string;
  schedule_time: string;
  lineup: string;
  category: string;
  price: string;
  coin_price: number;
  background_image_url: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  regular: "🎭 Reguler",
  birthday: "🎂 Ulang Tahun",
  special: "⭐ Spesial",
  anniversary: "🎉 Anniversary",
  last_show: "👋 Last Show",
};

const SchedulePage = () => {
  const [shows, setShows] = useState<ScheduleShow[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.rpc("get_public_shows");
      if (data) {
        const upcoming = (data as any[]).filter(s => !s.is_replay && s.schedule_date);
        setShows(upcoming);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  // Countdown timers
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const next: Record<string, string> = {};
      shows.forEach(s => {
        if (!s.schedule_date || !s.schedule_time) return;
        const target = new Date(`${s.schedule_date}T${s.schedule_time}`).getTime();
        const diff = target - now;
        if (diff <= 0) {
          next[s.id] = "LIVE!";
        } else {
          const d = Math.floor(diff / 86400000);
          const h = Math.floor((diff % 86400000) / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const sec = Math.floor((diff % 60000) / 1000);
          next[s.id] = d > 0
            ? `${d}h ${h}j ${m}m`
            : `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
        }
      });
      setCountdowns(next);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [shows]);

  return (
    <div className="min-h-screen bg-background">
      <SharedNavbar activePage="home" />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Jadwal Show</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <img src={logo} alt="Loading" className="h-10 w-10 animate-pulse" />
          </div>
        ) : shows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Belum ada jadwal show mendatang</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shows.map((show, i) => (
              <motion.div
                key={show.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                {show.background_image_url && (
                  <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${show.background_image_url})` }}>
                    <div className="h-full w-full bg-gradient-to-t from-card to-transparent" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground mb-1">
                        {CATEGORY_LABELS[show.category] || show.category}
                      </p>
                      <h3 className="text-sm font-bold text-foreground">{show.title}</h3>
                      {show.lineup && (
                        <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{show.lineup}</p>
                      )}
                    </div>
                    {countdowns[show.id] && (
                      <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-center">
                        <Timer className="mx-auto mb-0.5 h-3.5 w-3.5 text-primary" />
                        <p className={`font-mono text-xs font-bold ${countdowns[show.id] === "LIVE!" ? "text-destructive" : "text-primary"}`}>
                          {countdowns[show.id]}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {show.schedule_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {show.schedule_time}
                    </span>
                    {show.coin_price > 0 && (
                      <span className="flex items-center gap-1">
                        <Ticket className="h-3 w-3" /> {show.coin_price} Koin
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulePage;
