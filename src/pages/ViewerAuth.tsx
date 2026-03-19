import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Coins, Mail, Lock, ArrowLeft, Phone, User, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthMethod = "phone" | "email";

const ViewerAuth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [method, setMethod] = useState<AuthMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();

  const normalizePhone = (raw: string) => raw.replace(/[^0-9]/g, "");
  const deriveEmail = (phoneNum: string) => `${normalizePhone(phoneNum)}@rt48.user`;

  const getAuthEmail = () => {
    if (method === "email") return email.trim();
    return deriveEmail(phone);
  };

  const isFormValid = () => {
    if (mode === "forgot") return email.trim().includes("@");
    if (mode === "signup" && !username.trim()) return false;
    if (mode === "signup" && method === "phone" && normalizePhone(phone).length < 10) return false;
    if (mode === "signup" && method === "email" && !email.trim().includes("@")) return false;
    if (method === "phone") return normalizePhone(phone).length >= 10 && password.length >= 6;
    return email.trim().includes("@") && password.length >= 6;
  };

  const getOtpTarget = () => {
    if (method === "phone") return phone;
    // For email method, we still need phone for OTP
    return phone;
  };

  const handleSendOtp = async () => {
    // For signup, always need phone for OTP
    const target = normalizePhone(phone);
    if (target.length < 10) {
      toast({ title: "Nomor HP tidak valid", variant: "destructive" });
      return;
    }
    setOtpSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: target },
      });
      if (error || !data?.success) {
        toast({ title: "Gagal kirim OTP", description: data?.error || error?.message, variant: "destructive" });
      } else {
        setOtpPhone(data.phone);
        setOtpStep(true);
        toast({ title: "OTP terkirim!", description: "Cek WhatsApp kamu untuk kode verifikasi." });
      }
    } catch {
      toast({ title: "Gagal kirim OTP", variant: "destructive" });
    }
    setOtpSending(false);
  };

  const handleVerifyAndSignup = async () => {
    setLoading(true);
    try {
      // Verify OTP first
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-otp", {
        body: { phone: otpPhone, code: otpCode },
      });
      if (verifyError || !verifyData?.success) {
        toast({ title: "OTP salah", description: verifyData?.error || "Kode OTP salah atau kedaluwarsa.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // OTP verified, proceed with signup
      const authEmail = getAuthEmail();
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
    } catch {
      toast({ title: "Terjadi kesalahan", variant: "destructive" });
    }
    setLoading(false);
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

    // For signup, send OTP first (if not in OTP step)
    if (mode === "signup" && !otpStep) {
      await handleSendOtp();
      return;
    }

    // For signup with OTP step, verify and signup
    if (mode === "signup" && otpStep) {
      await handleVerifyAndSignup();
      return;
    }

    // Login flow (no OTP needed)
    setLoading(true);
    const authEmail = getAuthEmail();
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (error) {
      toast({ title: "Login gagal", description: "Nomor/email atau password salah.", variant: "destructive" });
    } else {
      navigate("/coins");
    }
    setLoading(false);
  };

  const resetOtp = () => {
    setOtpStep(false);
    setOtpCode("");
    setOtpPhone("");
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
            {otpStep ? "Verifikasi OTP" : mode === "login" ? "Masuk ke Akun" : mode === "signup" ? "Buat Akun Baru" : "Lupa Password"}
          </h2>

          {otpStep ? (
            /* OTP Verification Step */
            <>
              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-primary" />
                <p className="text-xs text-muted-foreground">
                  Kode OTP telah dikirim ke WhatsApp<br />
                  <span className="font-medium text-foreground">{otpPhone}</span>
                </p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={loading || otpCode.length < 6}>
                {loading ? "Memverifikasi..." : "Verifikasi & Daftar"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={resetOtp} className="text-muted-foreground hover:text-foreground">
                  ← Kembali
                </button>
                <button type="button" onClick={handleSendOtp} disabled={otpSending} className="text-primary hover:underline">
                  {otpSending ? "Mengirim..." : "Kirim Ulang OTP"}
                </button>
              </div>
            </>
          ) : mode === "forgot" ? (
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

              {/* Phone field - always show for signup (needed for OTP) */}
              {(method === "phone" || mode === "signup") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Nomor HP {mode === "signup" && method === "email" && <span className="text-[10px]">(untuk verifikasi OTP)</span>}
                  </label>
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
                {loading || otpSending ? "Memproses..." : mode === "login" ? "Masuk" : "Kirim OTP & Daftar"}
              </Button>

              {mode === "login" && method === "email" && (
                <button type="button" onClick={() => setMode("forgot")} className="w-full text-center text-[11px] text-muted-foreground hover:text-primary">
                  Lupa password?
                </button>
              )}

              <p className="text-center text-xs text-muted-foreground">
                {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}
                <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); resetOtp(); }} className="ml-1 font-medium text-primary hover:underline">
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
