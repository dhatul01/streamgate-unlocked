import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import BannedScreen from "./BannedScreen";

interface BanInfo {
  banned: boolean;
  ip?: string;
  reason?: string;
  blocked_at?: string;
}

const CACHE_KEY = "ip_ban_check_v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const IpGate = ({ children }: { children: React.ReactNode }) => {
  const [info, setInfo] = useState<BanInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.t < CACHE_TTL) {
            if (!cancelled) {
              setInfo(parsed.data);
              setChecked(true);
            }
            return;
          }
        }
        const { data } = await supabase.functions.invoke("check-ip", {
          body: { path: window.location.pathname },
        });
        if (cancelled) return;
        const result = (data as BanInfo) || { banned: false };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: result }));
        setInfo(result);
      } catch {
        // fail open
      } finally {
        if (!cancelled) setChecked(true);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checked && info?.banned) {
    return <BannedScreen ip={info.ip} reason={info.reason} blockedAt={info.blocked_at} />;
  }
  return <>{children}</>;
};

export default IpGate;
