import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Calendar, Clock, Users, MessageCircle, Ticket, Coins, Copy, Radio, Film, Timer,
} from "lucide-react";
import type { Show } from "@/types/show";
import { SHOW_CATEGORIES } from "@/types/show";
import { supabase } from "@/integrations/supabase/client";

interface ShowCardProps {
  show: Show;
  index: number;
  isReplayMode: boolean;
  redeemedToken?: string;
  accessPassword?: string;
  replayPassword?: string;
  onBuy: (show: Show) => void;
  onCoinBuy: (show: Show) => void;
  showCountdown?: boolean;
}

const INDONESIAN_MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

function parseShowDateTime(dateStr: string, timeStr: string): number | null {
  if (!dateStr || !timeStr) return null;
  const cleanTime = timeStr.replace(/\s*WIB\s*/i, "").trim().replace(/\./g, ":");
  const [hour, minute] = cleanTime.split(":").map(Number);

  // Try ISO format first (2026-03-20)
  let d = new Date(`${dateStr}T${cleanTime.padStart(5, "0")}:00`);
  if (!isNaN(d.getTime())) return d.getTime();

  // Try Indonesian format (20 maret 2026)
  const parts = dateStr.toLowerCase().trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = INDONESIAN_MONTHS[parts[1]];
    const year = parseInt(parts[2]);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day, hour || 0, minute || 0).getTime();
    }
  }
  return null;
}

function useCountdown(dateStr: string, timeStr: string) {
  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const target = parseShowDateTime(dateStr, timeStr);
    if (!target) return;

    const update = () => {
      const current = Date.now();
      setNow(current);
      const diff = target - current;
      if (diff <= 0) { setText("LIVE!"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setText(
        d > 0
          ? `${d}h ${h}j ${m}m`
          : `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [dateStr, timeStr]);

  return { text, now };
}

// Shared member-photo cache (loaded once across all ShowCards)
type MemberPhoto = { name: string; photo_url: string };
let _memberCache: MemberPhoto[] | null = null;
let _memberPromise: Promise<MemberPhoto[]> | null = null;
const loadMembers = (): Promise<MemberPhoto[]> => {
  if (_memberCache) return Promise.resolve(_memberCache);
  if (_memberPromise) return _memberPromise;
  _memberPromise = (async () => {
    const { data } = await supabase.from("members").select("name, photo_url");
    _memberCache = (data as MemberPhoto[] | null) || [];
    return _memberCache;
  })();
  return _memberPromise;
};
function useMemberPhotos() {
  const [list, setList] = useState<MemberPhoto[]>(_memberCache || []);
  useEffect(() => {
    if (_memberCache) return;
    loadMembers().then(setList);
  }, []);
  return list;
}

const ShowCard = ({
  show, index, isReplayMode, redeemedToken, accessPassword, replayPassword,
  onBuy, onCoinBuy, showCountdown = true,
}: ShowCardProps) => {
  const { toast } = useToast();
  const { text: countdown, now: currentTime } = useCountdown(show.schedule_date, show.schedule_time);

  const pw = accessPassword || replayPassword;
  const hasPw = pw && pw !== "__purchased__";

  // Match lineup names against the member photo library
  const memberPhotos = useMemberPhotos();
  const lineupMembers = useMemo(() => {
    if (!show.lineup) return [];
    const names = show.lineup.split(/[,\n;|]/).map((s) => s.trim()).filter(Boolean);
    return names.map((name) => {
      const match = memberPhotos.find((m) => m.name.toLowerCase() === name.toLowerCase());
      return { name, photo_url: match?.photo_url || "" };
    });
  }, [show.lineup, memberPhotos]);
  const hasMemberPhotos = lineupMembers.some((m) => m.photo_url);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative overflow-hidden rounded-2xl tv:rounded-3xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
    >
      {/* Image */}
      <div className="relative h-48 tv:h-72 overflow-hidden">
        {show.background_image_url ? (
          <img src={show.background_image_url} alt={show.title} loading="lazy" decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/10">
            <Ticket className="h-16 w-16 tv:h-24 tv:w-24 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

        {/* Category badge */}
        {show.category && show.category !== "regular" && (() => {
          const cat = SHOW_CATEGORIES[show.category] || SHOW_CATEGORIES.regular;
          const memberText = show.category_member && (show.category === "birthday" || show.category === "last_show")
            ? ` — ${show.category_member}` : "";
          return (
            <span className={`absolute top-3 left-3 tv:top-4 tv:left-4 rounded-full px-3 py-1 text-[10px] tv:text-xs font-bold backdrop-blur-sm ${cat.color}`}>
              {cat.label}{memberText}
            </span>
          );
        })()}

        {/* Countdown badge */}
        {showCountdown && countdown && (
          <div className="absolute top-3 right-3 tv:top-4 tv:right-4 rounded-lg bg-background/80 backdrop-blur-sm px-2.5 py-1.5 text-center">
            <Timer className="mx-auto mb-0.5 h-3 w-3 text-primary" />
            <p className={`font-mono text-[10px] font-bold ${countdown === "LIVE!" ? "text-destructive animate-pulse" : "text-primary"}`}>
              {countdown}
            </p>
          </div>
        )}

        <div className="absolute bottom-3 left-4 right-4 tv:bottom-5 tv:left-6">
          <h3 className="text-xl font-bold text-foreground tv:text-3xl">{show.title}</h3>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4 tv:p-6 tv:space-y-4">
        {isReplayMode && show.replay_coin_price > 0 ? (
          <div className="flex items-center gap-1.5 text-sm text-accent tv:text-base">
            <Film className="h-4 w-4 tv:h-5 tv:w-5" />
            <span className="font-semibold">Replay: {show.replay_coin_price} Koin</span>
          </div>
        ) : show.coin_price > 0 ? (
          <div className="flex items-center gap-1.5 text-sm text-warning tv:text-base">
            <Coins className="h-4 w-4 tv:h-5 tv:w-5" />
            <span className="font-semibold">{show.coin_price} Koin</span>
          </div>
        ) : null}

        <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground tv:text-lg tv:px-4 tv:py-1.5">{show.price}</span>

        {show.schedule_date && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground tv:text-base">
            <Calendar className="h-4 w-4 tv:h-5 tv:w-5 text-primary" />{show.schedule_date}
          </div>
        )}
        {show.schedule_time && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground tv:text-base">
            <Clock className="h-4 w-4 tv:h-5 tv:w-5 text-primary" />{show.schedule_time}
          </div>
        )}
        {show.lineup && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground tv:text-base">
            <Users className="mt-0.5 h-4 w-4 tv:h-5 tv:w-5 text-primary" />
            <span className="line-clamp-2">{show.lineup}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-2 flex flex-col gap-2">
          {redeemedToken && accessPassword && (() => {
            const showStart = parseShowDateTime(show.schedule_date, show.schedule_time);
            const accessOpens = showStart ? showStart - 2 * 60 * 60 * 1000 : null;
            const tooEarly = accessOpens ? currentTime < accessOpens : false;
            if (tooEarly) return null;
            return (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-center">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">🔐 Sandi Akses Show</p>
                <p className="font-mono text-lg font-bold text-warning">{accessPassword}</p>
              </div>
            );
          })()}

          {redeemedToken ? (
            isReplayMode ? (
              <div className="space-y-2">
                {hasPw && (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-center">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">🔐 Sandi Replay — salin sebelum menonton</p>
                    <p className="font-mono text-lg font-bold text-warning">{pw}</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (hasPw) {
                      navigator.clipboard.writeText(pw!);
                      toast({ title: "Sandi disalin! Membuka halaman replay..." });
                      setTimeout(() => { window.open("https://replaytime.lovable.app", "_blank"); }, 500);
                    } else {
                      window.open("https://replaytime.lovable.app", "_blank");
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 tv:py-4 font-semibold text-accent-foreground transition-all hover:bg-accent/90 tv:text-lg tv:rounded-2xl"
                >
                  <Copy className="h-4 w-4 tv:h-6 tv:w-6" /> {hasPw ? "Salin Sandi & Tonton Replay" : "Tonton Replay"}
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/live?t=${redeemedToken}`); toast({ title: "Link disalin!" }); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-2.5 tv:py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/80 tv:text-base tv:rounded-2xl"
                >
                  <Copy className="h-3.5 w-3.5 tv:h-5 tv:w-5" /> Salin Link Nonton
                </button>
              </div>
            ) : (
              <>
                {(() => {
                  const showStart = parseShowDateTime(show.schedule_date, show.schedule_time);
                  const accessOpens = showStart ? showStart - 2 * 60 * 60 * 1000 : null;
                  const isTooEarly = accessOpens ? currentTime < accessOpens : false;

                  if (isTooEarly && showStart) {
                    return (
                      <div className="rounded-xl border border-muted bg-muted/50 p-4 text-center space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">⏳ Menunggu Live Streaming</p>
                        <p className="font-mono text-2xl font-bold text-primary">{countdown}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {show.schedule_date} • {show.schedule_time}
                        </p>
                        <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-3 text-sm font-semibold text-muted-foreground/50 cursor-not-allowed tv:text-lg tv:rounded-2xl">
                          <Radio className="h-4 w-4 tv:h-6 tv:w-6" /> Menunggu Live...
                        </div>
                      </div>
                    );
                  }

                  return (
                    <>
                      <a
                        href={`/live?t=${redeemedToken}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3 tv:py-4 font-semibold text-primary-foreground transition-all hover:bg-success/90 hover:shadow-lg hover:shadow-success/25 tv:text-lg tv:rounded-2xl"
                      >
                        <Radio className="h-4 w-4 tv:h-6 tv:w-6" /> Tonton Live
                      </a>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/live?t=${redeemedToken}`); toast({ title: "Link disalin!" }); }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-2.5 tv:py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/80 tv:text-base tv:rounded-2xl"
                      >
                        <Copy className="h-3.5 w-3.5 tv:h-5 tv:w-5" /> Salin Link Nonton
                      </button>
                    </>
                  );
                })()}
              </>
            )
          ) : (
            <>
              {show.coin_price > 0 && (
                <button
                  onClick={() => onCoinBuy(show)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-warning py-3 tv:py-4 font-semibold text-warning-foreground transition-all hover:bg-warning/90 hover:shadow-lg hover:shadow-warning/25 tv:text-lg tv:rounded-2xl"
                >
                  <Coins className="h-4 w-4 tv:h-6 tv:w-6" /> Beli dengan {show.coin_price} Koin
                </button>
              )}
              <button
                onClick={() => onBuy(show)}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 tv:py-4 font-semibold transition-all tv:text-lg tv:rounded-2xl ${
                  show.coin_price > 0
                    ? "bg-muted text-muted-foreground hover:bg-muted/80"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                }`}
              >
                <MessageCircle className="h-4 w-4 tv:h-6 tv:w-6" /> {show.coin_price > 0 ? "Beli via QRIS" : "Beli Tiket"}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ShowCard;
