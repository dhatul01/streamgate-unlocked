import { motion } from "framer-motion";
import { Ticket, Sparkles } from "lucide-react";
import logo from "@/assets/logo.webp";
import heroBg from "@/assets/hero-bg.webp";
import HeroVideoBackground from "@/components/viewer/HeroVideoBackground";

interface Props {
  heroVideoUrl?: string;
  siteTitle: string;
}

const HeroSection = ({ heroVideoUrl, siteTitle }: Props) => {
  return (
    <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden pt-16 tv:pt-24">
      {/* Background image / video */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="h-full w-full object-cover opacity-30" />
        <HeroVideoBackground url={heroVideoUrl} poster={heroBg} brightness={45} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
      </div>

      {/* Aurora gradient blobs */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob--cyan" />
        <div className="aurora-blob aurora-blob--violet" />
        <div className="aurora-blob aurora-blob--pink" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 tv:h-2 tv:w-2 rounded-full bg-primary/50"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [0, -40, 0], opacity: [0.2, 0.9, 0.2] }}
            transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
      </div>

      {/* Subtle radial vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, hsl(var(--background)) 100%)",
        }}
      />

      <div className="relative z-10 text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, type: "spring", stiffness: 120 }}
        >
          <div className="relative mx-auto mb-6 inline-block">
            {/* Glow ring behind logo */}
            <div className="absolute inset-0 -m-4 rounded-full bg-gradient-to-tr from-primary/40 via-fuchsia-500/30 to-cyan-400/40 blur-2xl animate-pulse" />
            <img
              src={logo}
              alt="RealTime48"
              className="relative h-20 w-20 md:h-28 md:w-28 tv:h-40 tv:w-40 animate-float rounded-full border-2 border-primary/60 shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
            />
          </div>
        </motion.div>

        {/* Badge above title */}
        <motion.div
          className="mb-4 inline-flex items-center gap-2 rounded-full glass-aurora px-4 py-1.5 text-xs font-medium text-foreground/90 tv:text-base"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary tv:h-5 tv:w-5" />
          <span>Live Streaming Premium</span>
        </motion.div>

        <motion.h1
          className="mb-4 text-5xl font-extrabold tracking-tight md:text-7xl tv:text-9xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="text-foreground">Real</span>
          <span className="text-aurora">Time48</span>
        </motion.h1>

        <motion.p
          className="mx-auto mb-8 max-w-md text-muted-foreground md:text-lg tv:text-2xl tv:max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          {siteTitle}
        </motion.p>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <a
            href="#shows"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-primary via-fuchsia-500 to-primary bg-[length:200%_100%] bg-left px-8 py-3 tv:px-12 tv:py-5 font-semibold text-primary-foreground shadow-[0_10px_40px_-8px_hsl(var(--primary)/0.6)] transition-all duration-500 hover:bg-right hover:shadow-[0_14px_50px_-6px_hsl(var(--primary)/0.8)] hover:scale-105 tv:text-xl"
          >
            <Ticket className="h-5 w-5 tv:h-7 tv:w-7" /> Lihat Show
          </a>
          <a
            href="#deskripsi"
            className="inline-flex items-center gap-2 rounded-full glass-aurora px-6 py-3 tv:px-10 tv:py-5 text-sm font-medium text-foreground/90 transition-all hover:bg-foreground/5 hover:scale-105 tv:text-lg"
          >
            Pelajari Lebih
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
