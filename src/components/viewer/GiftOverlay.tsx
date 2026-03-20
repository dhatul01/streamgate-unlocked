import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Gift {
  id: string;
  sender_username: string;
  amount: number;
  message: string;
  gift_type: string;
}

const GIFT_EMOJIS: Record<string, string> = {
  coin: "🪙",
  heart: "❤️",
  star: "⭐",
  fire: "🔥",
  diamond: "💎",
  rocket: "🚀",
  crown: "👑",
  rose: "🌹",
};

const GiftOverlay = () => {
  const [activeGifts, setActiveGifts] = useState<Gift[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel("gift-overlay-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "coin_gifts" }, (payload) => {
        const gift = payload.new as Gift;
        setActiveGifts(prev => [...prev, gift]);
        setTimeout(() => {
          setActiveGifts(prev => prev.filter(g => g.id !== gift.id));
        }, 4000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      <AnimatePresence>
        {activeGifts.map((gift, index) => (
          <motion.div
            key={gift.id}
            initial={{ opacity: 0, x: -100, y: 100 + index * 60 }}
            animate={{ opacity: 1, x: 16, y: 100 + index * 60 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="absolute left-0 pointer-events-none"
          >
            <div className="flex items-center gap-2 rounded-full bg-card/90 border border-primary/30 px-3 py-1.5 shadow-lg backdrop-blur-sm">
              <span className="text-lg">{GIFT_EMOJIS[gift.gift_type] || "🪙"}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary truncate max-w-[120px]">
                  {gift.sender_username}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {gift.amount} koin {gift.message && `· ${gift.message}`}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Floating emojis for big gifts */}
      <AnimatePresence>
        {activeGifts.filter(g => g.amount >= 10).map((gift) => (
          <motion.div
            key={`emoji-${gift.id}`}
            initial={{ opacity: 1, y: "80%", x: `${30 + Math.random() * 40}%` }}
            animate={{ opacity: 0, y: "-20%" }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute text-3xl"
          >
            {GIFT_EMOJIS[gift.gift_type] || "🪙"}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default GiftOverlay;
