import { useEffect, useState } from "react";

const KEY = "jkt48_active_lyric_id";

export function useActiveLyric() {
  const [activeId, setActive] = useState<string | null>(() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  });

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(KEY, activeId);
      else localStorage.removeItem(KEY);
    } catch {}
  }, [activeId]);

  return [activeId, setActive] as const;
}
