import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Coins, Mail, Lock, ArrowLeft } from "lucide-react";

const ViewerAuth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/coins" },
      });
      if (error) {
        toast({ title: "Gagal daftar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Berhasil!", description: "Cek email kamu untuk verifikasi akun." });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login gagal", description: error.message, variant: "destructive" });
      } else {
        navigate("/coins");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-2xl font-bold text-foreground">
            Real<span className="text-primary">Time48</span>
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4 text-warning" />
            <span>Coin Shop</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-center text-lg font-semibold text-foreground">
            {mode === "login" ? "Masuk ke Akun" : "Buat Akun Baru"}
          </h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@contoh.com"
                required
                className="bg-background pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-background pl-10"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="ml-1 font-medium text-primary hover:underline"
            >
              {mode === "login" ? "Daftar" : "Masuk"}
            </button>
          </p>
        </form>

        <button
          onClick={() => navigate("/")}
          className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
        </button>
      </div>
    </div>
  );
};

export default ViewerAuth;
