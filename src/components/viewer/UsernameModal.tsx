import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface UsernameModalProps {
  onSubmit: (username: string) => void;
}

const UsernameModal = ({ onSubmit }: UsernameModalProps) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setChecking(true);
    setError("");

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("chat_messages")
      .select("username")
      .eq("username", trimmed)
      .gte("created_at", twoHoursAgo)
      .limit(1);

    if (data && data.length > 0) {
      setError("Username sudah digunakan, pilih yang lain");
      setChecking(false);
      return;
    }

    setChecking(false);
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md px-4">
      <div className="w-full max-w-sm tv:max-w-lg rounded-2xl border border-border bg-card p-8 tv:p-12 text-center shadow-2xl shadow-primary/5">
        <img src={logo} alt="RealTime48" className="mx-auto mb-5 h-14 w-14 tv:h-20 tv:w-20 animate-float" />
        <h2 className="mb-1 text-xl font-bold text-foreground tv:text-3xl">Masukkan Username</h2>
        <p className="mb-5 text-xs text-muted-foreground tv:text-base">Username unik untuk berinteraksi di live chat</p>
        <form onSubmit={handleSubmit} className="space-y-3 tv:space-y-5">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="Username kamu..."
            maxLength={20}
            className="bg-background text-center tv:h-14 tv:text-lg"
            autoFocus
          />
          {error && (
            <p className="text-xs font-medium text-destructive tv:text-sm">{error}</p>
          )}
          <Button type="submit" disabled={!name.trim() || checking} className="w-full tv:py-6 tv:text-lg">
            {checking ? "Memeriksa..." : "Masuk Chat"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default UsernameModal;
