import logo from "@/assets/logo.png";
import { Radio, List, Key, Monitor, Settings, LogOut, Theater, Globe, FileText, ClipboardList, Users, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  userRole: "admin" | "moderator";
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const allSections = [
  { id: "live", label: "Live Control", icon: Radio, adminOnly: false },
  { id: "playlist", label: "Playlist", icon: List, adminOnly: false },
  { id: "tokens", label: "Token Factory", icon: Key, adminOnly: false },
  { id: "shows", label: "Show Manager", icon: Theater, adminOnly: false },
  { id: "orders", label: "Order Langganan", icon: ClipboardList, adminOnly: false },
  { id: "descriptions", label: "Deskripsi LP", icon: FileText, adminOnly: false },
  { id: "monitor", label: "Monitor", icon: Monitor, adminOnly: false },
  { id: "site", label: "Website", icon: Globe, adminOnly: false },
  { id: "moderators", label: "Akun Moderator", icon: Users, adminOnly: true },
  { id: "settings", label: "Settings", icon: Settings, adminOnly: true },
];

const AdminSidebar = ({ activeSection, onSectionChange, onLogout, userRole }: AdminSidebarProps) => {
  const sections = allSections.filter((s) => !s.adminOnly || userRole === "admin");

  return (
    <aside className="hidden w-56 flex-col border-r border-border bg-card md:flex lg:w-64">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <img src={logo} alt="RealTime48" className="h-8 w-8" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground">Real<span className="text-primary">Time48</span></span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {userRole === "admin" ? "Admin" : "Moderator"}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => onSectionChange(s.id)}
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
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
