import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AdminSettings = () => {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const { toast } = useToast();

  const updateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setSavingEmail(true);

    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email diperbarui", description: "Cek email baru untuk konfirmasi." });
      setNewEmail("");
    }
    setSavingEmail(false);
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Password tidak cocok", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password diperbarui!" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">⚙️ Settings</h2>

      {/* Change Email */}
      <form onSubmit={updateEmail} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Ubah Email</h3>
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Email baru"
          className="bg-background"
          required
        />
        <Button type="submit" disabled={savingEmail}>
          {savingEmail ? "Menyimpan..." : "Update Email"}
        </Button>
      </form>

      {/* Change Password */}
      <form onSubmit={updatePassword} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Ubah Password</h3>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Password baru"
          className="bg-background"
          required
        />
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Konfirmasi password"
          className="bg-background"
          required
        />
        <Button type="submit" disabled={savingPassword}>
          {savingPassword ? "Menyimpan..." : "Update Password"}
        </Button>
      </form>
    </div>
  );
};

export default AdminSettings;
