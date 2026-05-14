import { motion } from "framer-motion";
import { Crown, Star } from "lucide-react";
import type { Show } from "@/types/show";

interface Props {
  subscriptionShows: Show[];
  subscriberCounts: Record<string, number>;
}

const SubscriptionsSection = ({ subscriptionShows, subscriberCounts }: Props) => {
  if (subscriptionShows.length === 0) return null;

  const hasOpen = subscriptionShows.some((show) => {
    const count = subscriberCounts[show.id] || 0;
    const spotsLeft = show.max_subscribers > 0 ? show.max_subscribers - count : null;
    const isFull = (spotsLeft !== null && spotsLeft <= 0) || show.is_order_closed;
    return !isFull;
  });
  const allFull = subscriptionShows.every((show) => {
    const count = subscriberCounts[show.id] || 0;
    const spotsLeft = show.max_subscribers > 0 ? show.max_subscribers - count : null;
    return spotsLeft !== null && spotsLeft <= 0;
  });
  const allClosed = subscriptionShows.every((show) => show.is_order_closed);

  return (
    <section id="subscriptions" className="px-4 py-6 tv:py-10 tv:px-8">
      <div className="mx-auto max-w-4xl tv:max-w-[1200px]">
        {hasOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="flex flex-col items-center gap-4 rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 p-6 tv:p-10 text-center"
          >
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 tv:h-8 tv:w-8 text-yellow-500" />
              <h3 className="text-lg font-bold text-foreground tv:text-2xl">Langganan Dibuka! 🎉</h3>
            </div>
            <p className="text-sm text-muted-foreground tv:text-base">Segera daftar membership untuk akses eksklusif streaming. Kuota terbatas!</p>
            <a
              href="/membership"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-3 tv:px-10 tv:py-4 font-bold text-background transition hover:shadow-lg hover:shadow-yellow-500/25 tv:text-lg"
            >
              <Star className="h-4 w-4 tv:h-5 tv:w-5" /> Daftar Membership
            </a>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-6 tv:p-10 text-center"
          >
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 tv:h-8 tv:w-8 text-destructive" />
              <h3 className="text-lg font-bold text-foreground tv:text-2xl">
                {allClosed ? "🔒 Pendaftaran Langganan Ditutup" : allFull ? "🔒 Langganan Penuh" : "🔒 Langganan Tidak Tersedia"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground tv:text-base">
              {allClosed ? "Pendaftaran membership sedang ditutup oleh admin. Nantikan pembukaan selanjutnya!" : "Semua kuota membership telah terisi. Pantau terus untuk pembukaan berikutnya!"}
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default SubscriptionsSection;
