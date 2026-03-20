import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, X } from "lucide-react";

const PasswordResetBanner = () => {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dismissed = sessionStorage.getItem("pw_reset_dismissed");
      if (dismissed) return;

      const { data, error } = await supabase.rpc("get_my_password_reset_status");
      if (error || !data) return;
      const result = data as any;
      if (result.has_reset) {
        setStatus(result.status);
        setVisible(true);
      }
    };
    check();
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem("pw_reset_dismissed", "1");
  };

  if (!visible) return null;

  return (
    <div className="relative mx-auto mb-4 max-w-md animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Password Berhasil Direset
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status === "completed"
              ? "Password baru kamu sudah aktif. Kamu sudah login dengan password terbaru."
              : "Reset password kamu telah disetujui. Cek WhatsApp untuk link membuat password baru."}
          </p>
        </div>
        <button onClick={dismiss} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PasswordResetBanner;
