import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.webp";
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { toast } = useToast();

  const pwdScore = useMemo(() => {
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) s++;
    return s; // 0-4
  }, [password]);

  const pwdMatch = confirmPassword.length > 0 && password === confirmPassword;
  const pwdMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4 rounded-xl border border-border bg-card p-6">
          <img src={logo} alt="RealTime48" className="mx-auto h-16 w-16" />
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">Link Tidak Valid</h1>
          <p className="text-sm text-muted-foreground">Link reset password tidak ditemukan atau sudah kedaluwarsa. Silakan minta link baru dari halaman lupa password.</p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Login
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4 rounded-xl border border-border bg-card p-6">
          <img src={logo} alt="RealTime48" className="mx-auto h-16 w-16" />
          <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
          <h1 className="text-xl font-bold text-foreground">Password Berhasil Diubah!</h1>
          <p className="text-sm text-muted-foreground">Sandi baru kamu sudah aktif. Silakan login kembali untuk melanjutkan.</p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Masuk Sekarang
          </Button>
        </div>
      </div>
    );
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 6) {
      setErrorMsg("Password minimal 6 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Konfirmasi password tidak cocok.");
      return;
    }
    setLoading(true);

    try {
      const isLegacy = token.length < 32;
      const { data, error } = isLegacy
        ? await supabase.functions.invoke("apply-password-reset", { body: { short_id: token, new_password: password } })
        : await supabase.functions.invoke("self-password-reset", { body: { action: "confirm", token, new_password: password } });

      if (error || !data?.success) {
        const desc = data?.error || error?.message || "Terjadi kesalahan, silakan coba lagi.";
        setErrorMsg(desc);
        toast({ title: "Gagal mengubah password", description: desc, variant: "destructive" });
      } else {
        setSuccess(true);
        toast({ title: "Berhasil!", description: "Password kamu telah diperbarui." });
      }
    } catch (err) {
      const desc = (err as Error).message || "Terjadi kesalahan jaringan.";
      setErrorMsg(desc);
      toast({ title: "Gagal", description: desc, variant: "destructive" });
    }
    setLoading(false);
  };

  const strengthLabel = ["Sangat Lemah", "Lemah", "Cukup", "Kuat", "Sangat Kuat"][pwdScore];
  const strengthColor = ["bg-destructive", "bg-destructive", "bg-warning", "bg-primary", "bg-green-500"][pwdScore];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-2xl font-bold text-foreground">Buat Password Baru</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Masukkan password baru untuk akunmu
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-4 rounded-xl border border-border bg-card p-6">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 karakter"
                required
                minLength={6}
                className="bg-background pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPwd ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex h-1.5 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 rounded-full transition-colors ${i < pwdScore ? strengthColor : "bg-muted"}`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Kekuatan: {strengthLabel}</p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Konfirmasi Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type={showPwd ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password"
                required
                minLength={6}
                className={`bg-background pl-10 ${pwdMismatch ? "border-destructive" : pwdMatch ? "border-green-500" : ""}`}
              />
            </div>
            {pwdMismatch && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3" /> Password tidak cocok
              </p>
            )}
            {pwdMatch && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-green-600">
                <ShieldCheck className="h-3 w-3" /> Password cocok
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading || password.length < 6 || password !== confirmPassword}>
            {loading ? "Menyimpan..." : "Simpan Password Baru"}
          </Button>
        </form>

        <button onClick={() => navigate("/auth")} className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Login
        </button>
      </div>
    </div>
  );
};

export default ResetPassword;
