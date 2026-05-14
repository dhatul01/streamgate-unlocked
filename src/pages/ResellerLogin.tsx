import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo.webp";
import { Loader2 } from "lucide-react";

const ResellerLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", session.user.id);
      if (roles?.some((r: { role: string }) => r.role === "reseller")) {
        navigate("/reseller/dashboard");
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", data.user.id);
      if (!roles?.some((r: { role: string }) => r.role === "reseller")) {
        await supabase.auth.signOut();
        throw new Error("Akun ini bukan reseller");
      }
      await supabase.rpc("reseller_log_action", {
        _action: "login",
        _metadata: { ua: navigator.userAgent.slice(0, 100) },
      });
      toast.success("Login berhasil");
      navigate("/reseller/dashboard");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src={logo} alt="RealTime48" className="h-14 w-14" />
          <div className="text-center">
            <h1 className="text-2xl font-bold">Reseller Login</h1>
            <p className="text-sm text-muted-foreground">Panel khusus reseller token</p>
          </div>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResellerLogin;
