import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Gift, Coins, LogIn } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GIFT_TYPES = [
  { type: "coin", emoji: "🪙", label: "Koin", min: 1 },
  { type: "heart", emoji: "❤️", label: "Love", min: 3 },
  { type: "star", emoji: "⭐", label: "Star", min: 5 },
  { type: "fire", emoji: "🔥", label: "Fire", min: 5 },
  { type: "diamond", emoji: "💎", label: "Diamond", min: 10 },
  { type: "rocket", emoji: "🚀", label: "Rocket", min: 15 },
  { type: "crown", emoji: "👑", label: "Crown", min: 25 },
  { type: "rose", emoji: "🌹", label: "Rose", min: 3 },
];

interface GiftButtonProps {
  isAuthenticated: boolean;
}

const GiftButton = ({ isAuthenticated }: GiftButtonProps) => {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(GIFT_TYPES[0]);
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenCode = searchParams.get("t") || "";

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const handleOpenGift = () => {
    if (!isLoggedIn) {
      // Redirect to login with return URL
      const returnUrl = `/live?t=${encodeURIComponent(tokenCode)}`;
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }
    setOpen(true);
  };

  const handleSend = async () => {
    if (!isLoggedIn) {
      const returnUrl = `/live?t=${encodeURIComponent(tokenCode)}`;
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (amount < selectedType.min) {
      toast({ title: "Minimum " + selectedType.min + " koin", variant: "destructive" });
      return;
    }

    setSending(true);
    const { data, error } = await supabase.rpc("send_coin_gift", {
      _amount: amount,
      _message: message.slice(0, 50),
      _gift_type: selectedType.type,
    });
    setSending(false);

    const result = data as any;
    if (error || !result?.success) {
      toast({ title: "Gagal", description: result?.error || error?.message || "Gagal mengirim gift", variant: "destructive" });
      return;
    }

    toast({ title: "Gift terkirim! " + selectedType.emoji });
    setOpen(false);
    setMessage("");
    setAmount(selectedType.min);
  };

  return (
    <>
      <button
        onClick={handleOpenGift}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20 text-warning transition hover:bg-warning/30 tv:h-14 tv:w-14"
        title={isLoggedIn ? "Kirim Gift" : "Login untuk kirim Gift"}
      >
        {isLoggedIn ? (
          <Gift className="h-4 w-4 tv:h-5 tv:w-5" />
        ) : (
          <LogIn className="h-4 w-4 tv:h-5 tv:w-5" />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-warning" /> Kirim Gift
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-2">
            {GIFT_TYPES.map((g) => (
              <button
                key={g.type}
                onClick={() => { setSelectedType(g); setAmount(g.min); }}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
                  selectedType.type === g.type
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <span className="text-xl">{g.emoji}</span>
                <span className="text-[9px] text-muted-foreground">{g.label}</span>
                <span className="text-[8px] text-warning">{g.min}+ koin</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Jumlah Koin</label>
              <Input
                type="number"
                min={selectedType.min}
                max={100}
                value={amount}
                onChange={(e) => setAmount(Math.max(selectedType.min, Number(e.target.value)))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Pesan (opsional)</label>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Pesan singkat..."
                maxLength={50}
                className="mt-1"
              />
            </div>
            <Button className="w-full gap-2" onClick={handleSend} disabled={sending}>
              <Coins className="h-4 w-4" />
              {sending ? "Mengirim..." : `Kirim ${selectedType.emoji} (${amount} Koin)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GiftButton;
