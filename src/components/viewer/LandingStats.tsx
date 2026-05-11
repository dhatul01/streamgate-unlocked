import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Theater, Users, Eye, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalShows: number;
  upcomingShows: number;
  liveViewers: number;
  totalMembers: number;
}

const LandingStats = () => {
  const [stats, setStats] = useState<Stats>({
    totalShows: 0,
    upcomingShows: 0,
    liveViewers: 0,
    totalMembers: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [showsRes, viewersRes, membersRes] = await Promise.all([
        supabase.rpc("get_public_shows"),
        supabase.rpc("get_viewer_count"),
        supabase.from("members").select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      const shows = (showsRes.data as any[]) || [];
      const upcoming = shows.filter((s) => !s.is_replay && !s.is_subscription).length;
      setStats({
        totalShows: shows.length,
        upcomingShows: upcoming,
        liveViewers: (viewersRes.data as number) || 0,
        totalMembers: membersRes.count || 0,
      });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const items = [
    { icon: Theater, label: "Total Show", value: stats.totalShows },
    { icon: Calendar, label: "Akan Datang", value: stats.upcomingShows },
    { icon: Eye, label: "Penonton Aktif", value: stats.liveViewers },
    { icon: Users, label: "Member", value: stats.totalMembers },
  ];

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-primary/20 bg-card/70 p-4 backdrop-blur-md hover-scale"
          >
            <Icon className="mb-2 h-5 w-5 text-primary" />
            <div className="text-2xl font-bold text-foreground tabular-nums md:text-3xl">{it.value}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground md:text-xs">{it.label}</div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default LandingStats;
