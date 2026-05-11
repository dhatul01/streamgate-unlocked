import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const ZONES = [
  { label: "WIB", tz: "Asia/Jakarta" },
  { label: "WITA", tz: "Asia/Makassar" },
  { label: "WIT", tz: "Asia/Jayapura" },
];

const fmt = (tz: string, d: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);

const ShowTimezoneStrip = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-full border border-primary/20 bg-card/60 px-4 py-2 backdrop-blur-md md:gap-4">
      <Clock className="h-4 w-4 text-primary" />
      {ZONES.map((z) => (
        <div key={z.label} className="flex items-center gap-1.5 text-xs md:text-sm">
          <span className="font-semibold text-primary">{z.label}</span>
          <span className="font-mono tabular-nums text-foreground">{fmt(z.tz, now)}</span>
        </div>
      ))}
    </div>
  );
};

export default ShowTimezoneStrip;
