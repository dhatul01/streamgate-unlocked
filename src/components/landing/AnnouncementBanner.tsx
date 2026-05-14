import { motion } from "framer-motion";
import { Info } from "lucide-react";

interface Props {
  enabled: boolean;
  text: string;
}

const AnnouncementBanner = ({ enabled, text }: Props) => {
  if (!enabled || !text) return null;
  return (
    <section className="px-4 tv:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-4xl tv:max-w-[1200px]"
      >
        <div className="relative overflow-hidden rounded-2xl border border-warning/30 bg-gradient-to-r from-warning/10 via-warning/5 to-primary/10 p-5 md:p-6 tv:p-8">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-warning/10 blur-2xl" />
          <div className="absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 tv:h-12 tv:w-12">
              <Info className="h-5 w-5 text-warning tv:h-6 tv:w-6" />
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-bold text-foreground tv:text-base">📢 Pengumuman</h3>
              <p className="text-xs leading-relaxed text-muted-foreground md:text-sm tv:text-base whitespace-pre-line">
                {text}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default AnnouncementBanner;
