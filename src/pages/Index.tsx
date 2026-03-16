import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import heroBg from "@/assets/hero-bg.jpg";
import { Calendar, Clock, Users, MessageCircle, Ticket } from "lucide-react";

interface Show {
  id: string;
  title: string;
  price: string;
  lineup: string;
  schedule_date: string;
  schedule_time: string;
  background_image_url: string | null;
  qris_image_url: string | null;
}

interface SiteSettings {
  whatsapp_number: string;
  purchase_message: string;
  site_title: string;
}

const Index = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({
    whatsapp_number: "",
    purchase_message: "",
    site_title: "RealTime48 Streaming",
  });
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [showsRes, settingsRes] = await Promise.all([
        supabase.from("shows").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("site_settings").select("*"),
      ]);
      if (showsRes.data) setShows(showsRes.data as Show[]);
      if (settingsRes.data) {
        const s: any = {};
        settingsRes.data.forEach((row: any) => { s[row.key] = row.value; });
        setSettings((prev) => ({ ...prev, ...s }));
      }
    };
    fetchData();
  }, []);

  const handleBuy = (show: Show) => {
    if (settings.whatsapp_number) {
      const msg = encodeURIComponent(`Halo, saya ingin membeli tiket untuk ${show.title} (${show.price})`);
      window.open(`https://wa.me/${settings.whatsapp_number}?text=${msg}`, "_blank");
    } else {
      setSelectedShow(show);
    }
  };

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
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.8, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <img src={logo} alt="RealTime48" className="mx-auto mb-6 h-20 w-20 md:h-28 md:w-28 animate-float" />
          </motion.div>

          <motion.h1
            className="mb-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Real<span className="text-primary">Time48</span>
          </motion.h1>

          <motion.p
            className="mx-auto mb-8 max-w-md text-muted-foreground md:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {settings.site_title}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <a
              href="#shows"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
            >
              <Ticket className="h-5 w-5" /> Lihat Show
            </a>
          </motion.div>
        </div>
      </section>

      {/* Shows Section */}
      <section id="shows" className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            className="mb-12 text-center text-3xl font-bold text-foreground md:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            🎭 Jadwal Show
          </motion.h2>

          {shows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">Belum ada show tersedia</p>
              <p className="mt-2 text-muted-foreground">{settings.purchase_message}</p>
              {settings.whatsapp_number && (
                <a
                  href={`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent("Halo, saya ingin bertanya tentang streaming")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 font-semibold text-primary-foreground transition hover:bg-success/90"
                >
                  <MessageCircle className="h-4 w-4" /> Hubungi WhatsApp
                </a>
              )}
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
                  {/* Background image */}
                  <div className="relative h-48 overflow-hidden">
                    {show.background_image_url ? (
                      <img
                        src={show.background_image_url}
                        alt={show.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
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

                  {/* Details */}
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                        {show.price}
                      </span>
                    </div>

                    {show.schedule_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary" />
                        {show.schedule_date}
                      </div>
                    )}

                    {show.schedule_time && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        {show.schedule_time}
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
          <span className="text-sm font-semibold text-foreground">
            Real<span className="text-primary">Time48</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Secure Streaming Platform</p>
      </footer>

      {/* QRIS Modal */}
      {selectedShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6"
          >
            <h3 className="mb-4 text-lg font-bold text-foreground">{selectedShow.title}</h3>
            <p className="mb-4 text-muted-foreground">{settings.purchase_message}</p>
            {selectedShow.qris_image_url && (
              <img src={selectedShow.qris_image_url} alt="QRIS" className="mx-auto mb-4 max-h-64 rounded-lg" />
            )}
            {settings.whatsapp_number && (
              <a
                href={`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(`Halo, saya ingin membeli tiket untuk ${selectedShow.title} (${selectedShow.price})`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3 font-semibold text-primary-foreground transition hover:bg-success/90"
              >
                <MessageCircle className="h-4 w-4" /> Hubungi WhatsApp
              </a>
            )}
            <button
              onClick={() => setSelectedShow(null)}
              className="w-full rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80"
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
