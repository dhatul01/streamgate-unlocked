import { motion } from "framer-motion";
import { MessageCircle, Radio, X } from "lucide-react";
import type { Show } from "@/types/show";
import ShowCard from "@/components/viewer/ShowCard";
import { LandingShowsSkeleton } from "@/components/viewer/SkeletonLoaders";
import type { SiteSettings } from "./types";

interface Props {
  loading: boolean;
  error: string | null;
  regularShows: Show[];
  settings: SiteSettings;
  redeemedTokens: Record<string, string>;
  accessPasswords: Record<string, string>;
  replayPasswords: Record<string, string>;
  isShowReplayMode: (s: Show) => boolean;
  onBuy: (s: Show) => void;
  onCoinBuy: (s: Show) => void;
  onRetry: () => void;
}

const ShowsSection = ({
  loading, error, regularShows, settings,
  redeemedTokens, accessPasswords, replayPasswords,
  isShowReplayMode, onBuy, onCoinBuy, onRetry,
}: Props) => {
  return (
    <section id="shows" className="px-4 py-16 md:py-24 tv:py-32 tv:px-8">
      <div className="mx-auto max-w-6xl tv:max-w-[1600px]">
        <motion.h2
          className="mb-12 text-center text-3xl font-bold text-foreground md:text-4xl tv:text-5xl tv:mb-16"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        >
          🎭 Jadwal Show
        </motion.h2>

        {loading ? (
          <LandingShowsSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 tv:p-16 text-center animate-fade-in">
            <X className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <p className="text-base font-semibold text-foreground">Gagal memuat daftar show</p>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
            <button
              onClick={onRetry}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 hover-scale"
            >
              <Radio className="h-4 w-4" /> Coba Lagi
            </button>
          </div>
        ) : regularShows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 tv:p-20 text-center">
            <MessageCircle className="mx-auto mb-4 h-12 w-12 tv:h-16 tv:w-16 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground tv:text-2xl">Belum ada show tersedia</p>
            <p className="mt-2 text-muted-foreground tv:text-lg">{settings.purchase_message}</p>
            {settings.whatsapp_number && (
              <a
                href={`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent("Halo, saya ingin bertanya tentang streaming")}`}
                target="_blank" rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-success px-6 py-3 tv:px-10 tv:py-4 font-semibold text-primary-foreground transition hover:bg-success/90 tv:text-lg"
              >
                <MessageCircle className="h-4 w-4 tv:h-6 tv:w-6" /> Hubungi WhatsApp
              </a>
            )}
          </div>
        ) : (
          <div className="grid gap-6 tv:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {regularShows.map((show, i) => (
              <ShowCard
                key={show.id}
                show={show}
                index={i}
                isReplayMode={isShowReplayMode(show)}
                redeemedToken={redeemedTokens[show.id]}
                accessPassword={accessPasswords[show.id]}
                replayPassword={replayPasswords[show.id]}
                onBuy={onBuy}
                onCoinBuy={onCoinBuy}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ShowsSection;
