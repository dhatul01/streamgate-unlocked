import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Lock, ArrowLeft } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    } else {
      // Listen for auth state change (recovery event)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setReady(true);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return;
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password berhasil diubah!" });
      navigate("/coins");
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <img src={logo} alt="RealTime48" className="mx-auto h-16 w-16" />
          <p className="text-sm text-muted-foreground">Memverifikasi link reset...</p>
          <button onClick={() => navigate("/auth")} className="flex items-center justify-center gap-2 text-sm text-primary hover:underline mx-auto">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
        </div>

        <form onSubmit={handleReset} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 karakter" required minLength={6} className="bg-background pl-10" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || password.length < 6}>
            {loading ? "Menyimpan..." : "Simpan Password Baru"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
