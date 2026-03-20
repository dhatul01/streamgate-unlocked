import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Coins, Mail, Lock, ArrowLeft, Phone, User } from "lucide-react";

type AuthMethod = "phone" | "email";

const ViewerAuth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [method, setMethod] = useState<AuthMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { toast } = useToast();

  const getRedirectPath = () => redirectTo || "/coins";

  const normalizePhone = (raw: string) => raw.replace(/[^0-9]/g, "");
  const deriveEmail = (phoneNum: string) => `${normalizePhone(phoneNum)}@rt48.user`;

  const getAuthEmail = () => {
    if (method === "email") return email.trim();
    return deriveEmail(phone);
  };

  const isFormValid = () => {
    if (mode === "forgot") return email.trim().includes("@");
    if (mode === "signup" && !username.trim()) return false;
    if (method === "phone") return normalizePhone(phone).length >= 10 && password.length >= 6;
    return email.trim().includes("@") && password.length >= 6;
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email terkirim!", description: "Cek email kamu untuk reset password." });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") return handleForgot(e);
    if (!isFormValid()) return;

    setLoading(true);
    const authEmail = getAuthEmail();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: { data: { username: username.trim() } },
      });
      if (error) {
        const msg = error.message.includes("already registered")
          ? "Nomor/email ini sudah terdaftar. Silakan masuk."
          : error.message;
        toast({ title: "Gagal daftar", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Berhasil!" });
        navigate("/coins");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
      if (error) {
        toast({ title: "Login gagal", description: "Nomor/email atau password salah.", variant: "destructive" });
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
            {mode === "login" ? "Masuk ke Akun" : mode === "signup" ? "Buat Akun Baru" : "Lupa Password"}
          </h2>

          {mode === "forgot" ? (
            <>
              <p className="text-center text-xs text-muted-foreground">
                Masukkan email yang terdaftar untuk reset password.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" required className="bg-background pl-10" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !isFormValid()}>
                {loading ? "Mengirim..." : "Kirim Link Reset"}
              </Button>
              <button type="button" onClick={() => setMode("login")} className="w-full text-center text-xs text-primary hover:underline">
                Kembali ke Login
              </button>
            </>
          ) : (
            <>
              {/* Method toggle */}
              <div className="flex rounded-lg bg-secondary p-1">
                <button type="button" onClick={() => setMethod("phone")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${method === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Phone className="h-3.5 w-3.5" /> No. HP
                </button>
                <button type="button" onClick={() => setMethod("email")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${method === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </button>
              </div>

              {/* Username (signup only) */}
              {mode === "signup" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="NamaKamu" required maxLength={30} className="bg-background pl-10" />
                  </div>
                </div>
              )}

              {/* Phone field */}
              {method === "phone" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Nomor HP</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" required className="bg-background pl-10" />
                  </div>
                </div>
              )}

              {/* Email field */}
              {method === "email" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" required className="bg-background pl-10" />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 karakter" required minLength={6} className="bg-background pl-10" />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !isFormValid()}>
                {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}
              </Button>

              {mode === "login" && method === "email" && (
                <button type="button" onClick={() => setMode("forgot")} className="w-full text-center text-[11px] text-muted-foreground hover:text-primary">
                  Lupa password?
                </button>
              )}

              <p className="text-center text-xs text-muted-foreground">
                {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}
                <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="ml-1 font-medium text-primary hover:underline">
                  {mode === "login" ? "Daftar" : "Masuk"}
                </button>
              </p>
            </>
          )}
        </form>

        <button onClick={() => navigate("/")} className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
        </button>
      </div>
    </div>
  );
};

export default ViewerAuth;
