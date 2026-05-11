import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Radio, Coins, Users, Sparkles, MessageCircle } from "lucide-react";
import logo from "@/assets/logo.webp";
import { supabase } from "@/integrations/supabase/client";
import SharedNavbar from "@/components/viewer/SharedNavbar";

const features = [
  { icon: Radio, title: "Streaming Real-Time", desc: "Tonton show favoritmu secara live dengan kualitas HD dan latensi rendah." },
  { icon: Shield, title: "Akses Aman", desc: "Sistem token & enkripsi memastikan hanya kamu yang bisa menonton." },
  { icon: Coins, title: "Ekonomi Koin", desc: "Beli akses, kirim gift, dan dapatkan reward dengan koin RealTime48." },
  { icon: Users, title: "Komunitas Aktif", desc: "Live chat, leaderboard, polling, dan event eksklusif setiap minggu." },
];

const AboutPage = () => {
  const [whatsapp, setWhatsapp] = useState<string>("");

  useEffect(() => {
    supabase.from("site_settings").select("whatsapp_number").maybeSingle().then(({ data }) => {
      if (data?.whatsapp_number) setWhatsapp(data.whatsapp_number);
    });
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background">
      <SharedNavbar />

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-24">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-20 w-20 rounded-full border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
          <h1 className="text-3xl font-extrabold text-foreground md:text-4xl">
            Tentang <span className="text-primary">RealTime48</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Platform streaming aman & elegan untuk pertunjukan, event, dan komunitas favorit kamu.
          </p>
        </motion.div>

        <section className="grid gap-4 md:grid-cols-2">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1 text-lg font-bold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            );
          })}
        </section>

        <section className="mt-10 rounded-2xl border border-primary/20 bg-card/70 p-6 backdrop-blur-md">
          <div className="mb-2 inline-flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Visi</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground md:text-base">
            Menjadi platform streaming komunitas terdepan di Indonesia dengan pengalaman menonton yang aman,
            interaktif, dan terjangkau untuk semua penggemar.
          </p>
        </section>

        {whatsapp && (
          <div className="mt-8 text-center">
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Halo RealTime48, saya ingin bertanya")}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 font-semibold text-primary-foreground transition hover:bg-success/90"
            >
              <MessageCircle className="h-4 w-4" /> Hubungi Kami
            </a>
          </div>
        )}
      </main>
    </div>
  );
};

export default AboutPage;
