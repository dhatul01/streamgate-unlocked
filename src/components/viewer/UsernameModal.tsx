import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface UsernameModalProps {
  onSubmit: (username: string) => void;
}

const UsernameModal = ({ onSubmit }: UsernameModalProps) => {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <img src={logo} alt="RealTime48" className="mx-auto mb-4 h-12 w-12" />
        <h2 className="mb-1 text-lg font-bold text-foreground">Masukkan Username</h2>
        <p className="mb-4 text-xs text-muted-foreground">Username untuk berinteraksi di live chat</p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Username kamu..."
            maxLength={20}
            className="bg-background"
            autoFocus
          />
          <Button type="submit" disabled={!name.trim()}>OK</Button>
        </form>
      </div>
    </div>
  );
};

export default UsernameModal;
