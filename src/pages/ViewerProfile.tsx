import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";
import { ArrowLeft, Coins, Save, User, History } from "lucide-react";
import { motion } from "framer-motion";

const ViewerProfile = () => {
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUser(user);

      const [profileRes, balRes, txRes] = await Promise.all([
        (supabase.from as any)("profiles").select("username").eq("id", user.id).maybeSingle(),
        (supabase.from as any)("coin_balances").select("balance").eq("user_id", user.id).maybeSingle(),
        (supabase.from as any)("coin_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);

      const name = profileRes.data?.username || user.user_metadata?.username || "";
      setUsername(name);
      setOriginalUsername(name);
      setBalance(balRes.data?.balance || 0);
      setTransactions(txRes.data || []);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleSave = async () => {
    if (!user || !username.trim()) return;
    setSaving(true);
    const { error } = await (supabase.from as any)("profiles").update({ username: username.trim() }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    } else {
      setOriginalUsername(username.trim());
      toast({ title: "Username diperbarui!" });
    }
  };

  const hasChanges = username.trim() !== originalUsername;

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><img src={logo} alt="Loading" className="h-12 w-12 animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold text-foreground">Profil Saya</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5">
            <Coins className="h-4 w-4 text-warning" />
            <span className="text-sm font-bold text-warning">{balance}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Avatar & username card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card p-6"
        >
          <div className="mb-5 flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              className="bg-background"
              maxLength={30}
            />
            <Button
              className="w-full gap-2"
              disabled={!hasChanges || saving || !username.trim()}
              onClick={handleSave}
            >
              <Save className="h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan Username"}
            </Button>
          </div>
        </motion.div>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Saldo Koin</p>
              <div className="flex items-center gap-2 mt-1">
                <Coins className="h-5 w-5 text-warning" />
                <span className="text-2xl font-bold text-warning">{balance}</span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/coins")}>
              <Coins className="mr-1.5 h-3.5 w-3.5" /> Beli Koin
            </Button>
          </div>
        </motion.div>

        {/* Recent transactions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Transaksi Terakhir</h3>
          </div>
          {transactions.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Belum ada transaksi</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg bg-background p-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString("id-ID")}</p>
                  </div>
                  <span className={`text-sm font-bold ${tx.amount > 0 ? "text-success" : "text-destructive"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ViewerProfile;
