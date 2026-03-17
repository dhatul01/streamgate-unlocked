import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Monitor, Palette, LogOut, Key, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ModeratorSiteSettings from "@/components/moderator/ModeratorSiteSettings";
import ModeratorMonitor from "@/components/moderator/ModeratorMonitor";
import ModeratorTokenManager from "@/components/moderator/ModeratorTokenManager";

const sections = [
  { id: "monitor", label: "Monitor", icon: Monitor },
  { id: "tokens", label: "Token", icon: Key },
  { id: "site", label: "Pengaturan Site", icon: Palette },
];

const ModeratorDashboard = () => {
  const [activeSection, setActiveSection] = useState("monitor");
  const [loading, setLoading] = useState(true);
  const [moderator, setModerator] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/moderator"); return; }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "moderator");

      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        navigate("/moderator");
        return;
      }

      const { data: modData } = await supabase
        .from("moderators")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!modData) {
        await supabase.auth.signOut();
        navigate("/moderator");
        return;
      }

      setModerator(modData);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/moderator");
  };

  const handleSectionChange = (id: string) => {
    setActiveSection(id);
    setMobileOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case "monitor": return <ModeratorMonitor moderator={moderator} />;
      case "tokens": return <ModeratorTokenManager moderator={moderator} />;
      case "site": return <ModeratorSiteSettings moderator={moderator} onUpdate={setModerator} />;
      default: return <ModeratorMonitor moderator={moderator} />;
    }
  };

  const activeLabel = sections.find(s => s.id === activeSection)?.label || "Menu";
  const ActiveIcon = sections.find(s => s.id === activeSection)?.icon || Monitor;

  const SidebarNav = () => (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div>
          <span className="text-sm font-bold text-foreground">{moderator?.site_name}</span>
          <p className="text-[10px] text-muted-foreground">Moderator Panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => handleSectionChange(s.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                activeSection === s.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-56 flex-col border-r border-border bg-card md:flex lg:w-64">
        <SidebarNav />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-border bg-card px-3 py-2.5 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-1.5">
            <ActiveIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">{activeLabel}</span>
          </div>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-secondary">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <SidebarNav />
          </SheetContent>
        </Sheet>
      </div>

      <main className="flex-1 overflow-y-auto p-4 pt-16 md:p-6 md:pt-6 lg:p-8">
        {renderSection()}
      </main>
    </div>
  );
};

export default ModeratorDashboard;
