import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { Menu, User, Coins, Crown, Radio, CreditCard, Home, Play, Download } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface SharedNavbarProps {
  activePage?: "home" | "coins" | "membership" | "replay";
}

const SharedNavbar = ({ activePage }: SharedNavbarProps) => {
  const [coinUser, setCoinUser] = useState<any>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [coinUsername, setCoinUsername] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCoinUser(user);

      const [profileRes, balRes] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
        supabase.from("coin_balances").select("balance").eq("user_id", user.id).maybeSingle(),
      ]);
      setCoinUsername(profileRes.data?.username || "User");
      setCoinBalance(balRes.data?.balance || 0);
    };
    loadUser();

    // Realtime coin balance updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setCoinUser(session.user);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // Realtime subscription to coin_balances
  useEffect(() => {
    if (!coinUser) return;

    const channel = supabase
      .channel(`navbar-coin-balance-${coinUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coin_balances",
          filter: `user_id=eq.${coinUser.id}`,
        },
        (payload: any) => {
          if (payload.new?.balance !== undefined) {
            setCoinBalance(payload.new.balance);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [coinUser]);

  const menuItems = [
    { icon: <Home className="h-5 w-5 text-primary" />, label: "Beranda", description: "Halaman utama", href: "/", active: activePage === "home" },
    { icon: <Play className="h-5 w-5 text-primary" />, label: "Replay Show", description: "Tonton ulang show yang telah berlalu", href: "/replay", active: activePage === "replay" },
    { icon: <Radio className="h-5 w-5 text-primary" />, label: "Jadwal Show", description: "Lihat jadwal & countdown show", href: "/schedule", active: false },
    { icon: <CreditCard className="h-5 w-5 text-primary" />, label: "Coin Shop", description: "Beli & tukar koin", href: "/coins", active: activePage === "coins" },
    { icon: <Crown className="h-5 w-5 text-yellow-500" />, label: "Membership", description: "Paket langganan eksklusif", href: "/membership", active: activePage === "membership" },
  ];

  return (
    <nav className="sticky top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" className="flex items-center gap-2">
          <img src={logo} alt="RealTime48" className="h-8 w-8 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" />
          <span className="text-sm font-bold text-foreground">Real<span className="text-primary">Time48</span></span>
        </a>
        <div className="flex items-center gap-2">
          {coinUser && (
            <div className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5">
              <Coins className="h-4 w-4 text-warning" />
              <span className="text-sm font-bold text-warning">{coinBalance}</span>
            </div>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <button className="rounded-lg bg-secondary p-2 text-secondary-foreground transition hover:bg-secondary/80">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 border-border bg-card">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-foreground">
                  <img src={logo} alt="" className="h-6 w-6 rounded-full border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" /> RealTime48
                </SheetTitle>
              </SheetHeader>

              {coinUser && (
                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{coinUsername || "User"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Coins className="h-3.5 w-3.5 text-warning" />
                        <span className="text-xs font-bold text-warning">{coinBalance} Koin</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href="/profile" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/80">
                      <User className="h-3.5 w-3.5 text-primary" /> Profil
                    </a>
                    <a href="/coins" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs font-semibold text-warning transition hover:bg-warning/20">
                      <Coins className="h-3.5 w-3.5" /> Coin Shop
                    </a>
                  </div>
                </div>
              )}
              {!coinUser && (
                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <a href="/auth" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
                    <User className="h-4 w-4" /> Login / Daftar
                  </a>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {menuItems.map((item, i) => (
                  <a
                    key={i}
                    href={item.href}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                      item.active
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-background hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default SharedNavbar;
