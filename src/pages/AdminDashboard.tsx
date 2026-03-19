import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminNotifications from "@/components/admin/AdminNotifications";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveControl from "@/components/admin/LiveControl";
import PlaylistManager from "@/components/admin/PlaylistManager";
import TokenFactory from "@/components/admin/TokenFactory";
import ShowManager from "@/components/admin/ShowManager";
import MonitorView from "@/components/admin/MonitorView";
import AdminSettings from "@/components/admin/AdminSettings";
import SiteSettingsManager from "@/components/admin/SiteSettingsManager";
import LandingDescriptionManager from "@/components/admin/LandingDescriptionManager";
import SubscriptionOrderManager from "@/components/admin/SubscriptionOrderManager";
import ModeratorAccountManager from "@/components/admin/ModeratorAccountManager";
import CoinPackageManager from "@/components/admin/CoinPackageManager";
import CoinOrderManager from "@/components/admin/CoinOrderManager";

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState("live");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"admin" | "moderator">("moderator");
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin"); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some((r: any) => r.role === "admin");
      const isModerator = roles?.some((r: any) => r.role === "moderator");

      if (!isAdmin && !isModerator) {
        await supabase.auth.signOut();
        navigate("/admin");
        return;
      }

      setUserRole(isAdmin ? "admin" : "moderator");
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <img src={logo} alt="Loading" className="h-12 w-12 animate-float" />
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case "live": return <LiveControl />;
      case "playlist": return <PlaylistManager />;
      case "tokens": return <TokenFactory />;
      case "shows": return <ShowManager />;
      case "orders": return <SubscriptionOrderManager />;
      case "coin-packages": return userRole === "admin" ? <CoinPackageManager /> : null;
      case "coin-orders": return <CoinOrderManager />;
      case "descriptions": return <LandingDescriptionManager />;
      case "monitor": return <MonitorView />;
      case "site": return (
        <div className="space-y-6">
          <SiteSettingsManager />
          {userRole === "admin" && <AdminSettings />}
        </div>
      );
      case "moderators": return userRole === "admin" ? <ModeratorAccountManager /> : null;
      default: return <LiveControl />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
        userRole={userRole}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <img src={logo} alt="RealTime48" className="h-7 w-7 shrink-0" />
          <span className="flex-1 text-sm font-bold text-foreground">Real<span className="text-primary">Time48</span></span>
          <AdminNotifications />
        </header>
        {/* Desktop notification bar */}
        <header className="hidden shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-6 py-3 md:flex">
          <AdminNotifications />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 lg:p-8">
          {renderSection()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
