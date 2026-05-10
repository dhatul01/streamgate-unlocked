import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

interface Props {
  isLive: boolean;
  /** Only the live page should send heartbeat (count actual live viewers). Landing only displays. */
  trackPresence?: boolean;
}

const VIEWER_KEY_STORAGE = "rt48_viewer_key_v2";

const LiveViewerCount = ({ isLive, trackPresence = false }: Props) => {
  const [count, setCount] = useState(0);
  const viewerKeyRef = useRef<string>("");

  useEffect(() => {
    if (!isLive || !trackPresence) return;

    let key = localStorage.getItem(VIEWER_KEY_STORAGE) || "";
    if (!key) {
      key = `v_${crypto.randomUUID().slice(0, 12)}`;
      localStorage.setItem(VIEWER_KEY_STORAGE, key);
    }
    viewerKeyRef.current = key;

    supabase.rpc("viewer_heartbeat", { _key: key }).then(() => {
      setCount((current) => Math.max(current, 1));
      void supabase.rpc("get_viewer_count").then(({ data }) => {
        if (typeof data === "number") setCount(Math.max(data, 1));
      });
    });

    // Heartbeat every 30s ± 5s jitter — spreads load across 1000 viewers
    let hbTimer: ReturnType<typeof setTimeout>;
    const scheduleHb = () => {
      const delay = 25_000 + Math.random() * 10_000;
      hbTimer = setTimeout(() => {
        supabase.rpc("viewer_heartbeat", { _key: key }).then(() => {});
        scheduleHb();
      }, delay);
    };
    scheduleHb();

    return () => clearTimeout(hbTimer);
  }, [isLive, trackPresence]);

  useEffect(() => {
    if (!isLive) { setCount(0); return; }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;
    const fetchCount = async () => {
      const { data } = await supabase.rpc("get_viewer_count");
      if (!cancelled && typeof data === "number") {
        setCount(trackPresence && viewerKeyRef.current ? Math.max(data, 1) : data);
      }
    };
    // Initial fetch with small random delay to avoid thundering herd on page load
    pollTimer = setTimeout(function loop() {
      if (cancelled) return;
      fetchCount();
      // Poll every 15s ± 5s jitter
      pollTimer = setTimeout(loop, 12_000 + Math.random() * 6_000);
    }, Math.random() * 2_000);
    return () => { cancelled = true; clearTimeout(pollTimer); };
  }, [isLive, trackPresence]);

  if (!isLive || count === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 animate-in fade-in zoom-in-95 duration-200">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
      </span>
      <Users className="h-3 w-3 text-destructive" />
      <span className="text-xs font-bold text-destructive">{count}</span>
    </div>
  );
};

export default LiveViewerCount;
