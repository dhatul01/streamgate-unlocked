import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import AdminSidebar from "@/components/admin/AdminSidebar";
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
      case "descriptions": return <LandingDescriptionManager />;
      case "monitor": return <MonitorView />;
      case "site": return <SiteSettingsManager />;
      case "settings": return userRole === "admin" ? <AdminSettings /> : null;
      case "moderators": return userRole === "admin" ? <ModeratorAccountManager /> : null;
      default: return <LiveControl />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
        userRole={userRole}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {renderSection()}
      </main>
    </div>
  );
};

export default AdminDashboard;
