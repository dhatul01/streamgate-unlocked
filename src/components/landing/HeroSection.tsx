import { motion } from "framer-motion";
import { Ticket } from "lucide-react";
import logo from "@/assets/logo.webp";
import heroBg from "@/assets/hero-bg.webp";
import HeroVideoBackground from "@/components/viewer/HeroVideoBackground";

interface Props {
  heroVideoUrl?: string;
  siteTitle: string;
}

const HeroSection = ({ heroVideoUrl, siteTitle }: Props) => {
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden pt-16 tv:pt-24">
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="h-full w-full object-cover opacity-40" />
        <HeroVideoBackground url={heroVideoUrl} poster={heroBg} brightness={55} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
      </div>

      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 tv:h-2 tv:w-2 rounded-full bg-primary/40"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <img src={logo} alt="RealTime48" className="mx-auto mb-6 h-20 w-20 md:h-28 md:w-28 tv:h-40 tv:w-40 animate-float rounded-full border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
        </motion.div>
        <motion.h1
          className="mb-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl tv:text-8xl"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
        >
          Real<span className="text-primary">Time48</span>
        </motion.h1>
        <motion.p
          className="mx-auto mb-4 max-w-md text-muted-foreground md:text-lg tv:text-2xl tv:max-w-2xl"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
        >
          {siteTitle}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }}>
          <a
            href="#shows"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 tv:px-12 tv:py-5 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 tv:text-xl"
          >
            <Ticket className="h-5 w-5 tv:h-7 tv:w-7" /> Lihat Show
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
