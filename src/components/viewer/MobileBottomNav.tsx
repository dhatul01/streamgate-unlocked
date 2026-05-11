import { Home, Radio, Play, Coins, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const items = [
  { href: "/", label: "Beranda", icon: Home, match: (p: string) => p === "/" },
  { href: "/schedule", label: "Jadwal", icon: Radio, match: (p: string) => p.startsWith("/schedule") },
  { href: "/live", label: "Live", icon: Play, match: (p: string) => p.startsWith("/live"), highlight: true },
  { href: "/coins", label: "Koin", icon: Coins, match: (p: string) => p.startsWith("/coins") },
  { href: "/profile", label: "Profil", icon: User, match: (p: string) => p.startsWith("/profile") || p.startsWith("/auth") },
];

const HIDDEN_PREFIXES = ["/admin", "/reset-password", "/install", "/live"];

const MobileBottomNav = () => {
  const isMobile = useIsMobile();
  const location = useLocation();

  if (!isMobile) return null;
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <>
      {/* spacer so content isn't hidden under the bar */}
      <div className="h-16 md:hidden" aria-hidden />
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-stretch justify-around">
          {items.map((it) => {
            const active = it.match(location.pathname);
            const Icon = it.icon;
            return (
              <li key={it.href} className="flex-1">
                <a
                  href={it.href}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition ${
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      it.highlight && !active
                        ? "bg-primary/10 text-primary"
                        : active
                          ? "bg-primary/15"
                          : ""
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-medium">{it.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};

export default MobileBottomNav;
