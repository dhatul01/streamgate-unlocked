import { Coins, Menu, User } from "lucide-react";
import logo from "@/assets/logo.webp";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { MenuItem } from "./types";

interface Props {
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  coinUser: any;
  coinUsername: string;
  coinBalance: number;
  menuItems: MenuItem[];
}

const LandingNavbar = ({ sheetOpen, onSheetOpenChange, coinUser, coinUsername, coinBalance, menuItems }: Props) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl tv:max-w-[1600px] items-center justify-between px-4 py-3 tv:py-5 tv:px-8">
        <div className="flex items-center gap-2 tv:gap-3">
          <img src={logo} alt="RealTime48" className="h-8 w-8 tv:h-12 tv:w-12 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" />
          <span className="text-sm font-bold text-foreground tv:text-xl">Real<span className="text-primary">Time48</span></span>
        </div>
        <div className="flex items-center gap-2">
          {!sheetOpen && (
            <a href="/coins" className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5 tv:px-4 tv:py-2 text-warning transition hover:bg-warning/20" title="Coin Shop">
              <Coins className="h-4 w-4 tv:h-5 tv:w-5" />
              <span className="text-xs font-semibold tv:text-sm">Beli Koin</span>
            </a>
          )}
          <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
            <SheetTrigger asChild>
              <button className="rounded-lg bg-secondary p-2 tv:p-3 text-secondary-foreground transition hover:bg-secondary/80">
                <Menu className="h-5 w-5 tv:h-7 tv:w-7" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 tv:w-[420px] border-border bg-card">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-foreground tv:text-xl">
                  <img src={logo} alt="" className="h-6 w-6 tv:h-9 tv:w-9 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" /> RealTime48
                </SheetTitle>
              </SheetHeader>

              {coinUser ? (
                <div className="mt-4 rounded-xl border border-border bg-background p-4 tv:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground tv:text-base">{coinUsername || "User"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Coins className="h-3.5 w-3.5 text-warning" />
                        <span className="text-xs font-bold text-warning">{coinBalance} Koin</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href="/profile" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/80 tv:text-sm">
                      <User className="h-3.5 w-3.5 text-primary" /> Profil
                    </a>
                    <a href="/coins" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs font-semibold text-warning transition hover:bg-warning/20 tv:text-sm">
                      <Coins className="h-3.5 w-3.5" /> Coin Shop
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-border bg-background p-4 tv:p-5">
                  <a href="/auth" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
                    <User className="h-4 w-4" /> Login / Daftar
                  </a>
                </div>
              )}

              <div className="mt-4 space-y-2 tv:space-y-3">
                {menuItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-4 tv:p-5 text-left transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="mt-0.5 shrink-0">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground tv:text-base">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3 tv:text-sm">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default LandingNavbar;
