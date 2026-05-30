import { Sparkles, Megaphone, ArrowRight } from "lucide-react";

interface Props {
  enabled: boolean;
  title?: string;
  text?: string;
  buttonText?: string;
  url?: string;
}

const JoinChannelBanner = ({ enabled, title, text, buttonText, url }: Props) => {
  if (!enabled || !url) return null;
  const t = (title || "").trim() || "🔔 Gabung Saluran Resmi Kami";
  const d = (text || "").trim() || "Dapatkan info show terbaru, jadwal live, dan promo eksklusif langsung di HP kamu.";
  const b = (buttonText || "").trim() || "Gabung Sekarang";

  return (
    <div className="relative overflow-hidden border-b border-primary/30 bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 px-3 py-3">
      {/* shimmer */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />

      <div className="relative flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/40">
          <Megaphone className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            {t}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-foreground/85 line-clamp-2">
            {d}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary/50 active:scale-95"
          >
            {b}
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default JoinChannelBanner;
