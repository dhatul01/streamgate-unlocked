import logo from "@/assets/logo.png";
import { Radio, List, Key, Monitor, Settings, LogOut, Theater, Globe, FileText, ClipboardList, Users } from "lucide-react";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

const sections = [
  { id: "live", label: "Live Control", icon: Radio },
  { id: "playlist", label: "Playlist", icon: List },
  { id: "tokens", label: "Token Factory", icon: Key },
  { id: "shows", label: "Show Manager", icon: Theater },
  { id: "orders", label: "Order Langganan", icon: ClipboardList },
  { id: "descriptions", label: "Deskripsi LP", icon: FileText },
  { id: "moderators", label: "Moderator", icon: Users },
  { id: "monitor", label: "Monitor", icon: Monitor },
  { id: "site", label: "Website", icon: Globe },
  { id: "settings", label: "Settings", icon: Settings },
];

const AdminSidebar = ({ activeSection, onSectionChange, onLogout }: AdminSidebarProps) => {
  return (
    <aside className="hidden w-56 flex-col border-r border-border bg-card md:flex lg:w-64">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <img src={logo} alt="RealTime48" className="h-8 w-8" />
        <span className="text-sm font-bold text-foreground">Real<span className="text-primary">Time48</span></span>
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
