import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo.webp";
import ResellerStats from "@/components/reseller/ResellerStats";
import ResellerTokenCreator from "@/components/reseller/ResellerTokenCreator";
import ResellerTokenList from "@/components/reseller/ResellerTokenList";
import ResellerAuditLog from "@/components/reseller/ResellerAuditLog";

const ResellerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/reseller"); return; }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", session.user.id);
      if (!roles?.some((r: { role: string }) => r.role === "reseller")) {
        await supabase.auth.signOut();
        navigate("/reseller");
        return;
      }
      setLoading(false);
    })();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/reseller");
  };

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <img src={logo} alt="Loading" className="h-12 w-12 animate-pulse" />
    </div>;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="h-7 w-7" />
          <span className="text-sm font-bold">Real<span className="text-primary">Time48</span> · Reseller</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" /> Keluar
        </Button>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-3 py-6 md:px-6">
        <ResellerStats key={`stats-${refreshKey}`} />

        <Tabs defaultValue="create">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">Buat Token</TabsTrigger>
            <TabsTrigger value="tokens" className="flex-1">Token Saya</TabsTrigger>
            <TabsTrigger value="audit" className="flex-1">Audit Log</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="mt-4">
            <ResellerTokenCreator onCreated={() => setRefreshKey((k) => k + 1)} />
          </TabsContent>
          <TabsContent value="tokens" className="mt-4">
            <ResellerTokenList refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="audit" className="mt-4">
            <ResellerAuditLog />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ResellerDashboard;
