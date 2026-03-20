import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, TrendingUp, ArrowDownToLine, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Earning {
  id: string;
  amount: number;
  source: string;
  description: string;
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  account_number: string;
  status: string;
  notes: string;
  created_at: string;
  processed_at: string | null;
}

const EarningsManager = () => {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    const [earningsRes, withdrawalsRes] = await Promise.all([
      supabase.from("admin_earnings").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("admin_withdrawals").select("*").order("created_at", { ascending: false }),
    ]);

    const earningsData = earningsRes.data || [];
    const withdrawalsData = withdrawalsRes.data || [];

    setEarnings(earningsData as Earning[]);
    setWithdrawals(withdrawalsData as Withdrawal[]);

    const total = earningsData.reduce((sum: number, e: any) => sum + e.amount, 0);
    const withdrawn = withdrawalsData
      .filter((w: any) => w.status === "completed")
      .reduce((sum: number, w: any) => sum + w.amount, 0);

    setTotalEarnings(total);
    setTotalWithdrawn(withdrawn);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("earnings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_earnings" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_withdrawals" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleWithdraw = async () => {
    if (withdrawAmount <= 0 || !accountNumber.trim()) {
      toast({ title: "Isi jumlah dan nomor akun", variant: "destructive" });
      return;
    }
    const available = totalEarnings - totalWithdrawn;
    if (withdrawAmount > available) {
      toast({ title: "Saldo tidak cukup", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("admin_withdrawals").insert({
      amount: withdrawAmount,
      method: "gopay",
      account_number: accountNumber.trim(),
      status: "pending",
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Permintaan penarikan berhasil dibuat" });
      setWithdrawAmount(0);
      setAccountNumber("");
      fetchData();
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await supabase.from("admin_withdrawals").update({
      status,
      processed_at: status === "completed" ? new Date().toISOString() : null,
    }).eq("id", id);
    fetchData();
  };

  const available = totalEarnings - totalWithdrawn;
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + w.amount, 0);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Pendapatan Gift</h2>
        <p className="text-xs text-muted-foreground">Kelola pendapatan dari gift viewer untuk pencairan GoPay</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <TrendingUp className="mx-auto mb-1 h-5 w-5 text-success" />
          <p className="text-xl font-bold text-success">{totalEarnings}</p>
          <p className="text-[10px] text-muted-foreground">Total Pendapatan</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <ArrowDownToLine className="mx-auto mb-1 h-5 w-5 text-primary" />
          <p className="text-xl font-bold text-primary">{totalWithdrawn}</p>
          <p className="text-[10px] text-muted-foreground">Total Ditarik</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Coins className="mx-auto mb-1 h-5 w-5 text-warning" />
          <p className="text-xl font-bold text-warning">{available}</p>
          <p className="text-[10px] text-muted-foreground">Saldo Tersedia</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-xl font-bold text-foreground">{pendingWithdrawals}</p>
          <p className="text-[10px] text-muted-foreground">Menunggu Proses</p>
        </div>
      </div>

      {/* Withdrawal form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Tarik Saldo ke GoPay</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Jumlah Koin</label>
            <Input
              type="number"
              min={1}
              max={available}
              value={withdrawAmount || ""}
              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
              placeholder="Jumlah koin"
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Nomor GoPay</label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleWithdraw} disabled={submitting || withdrawAmount <= 0} className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              {submitting ? "Memproses..." : "Tarik"}
            </Button>
          </div>
        </div>
      </div>

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Riwayat Penarikan</h3>
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg bg-background p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{w.amount} Koin → {w.account_number}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] rounded px-1.5 py-0.5 font-medium ${
                      w.status === "completed" ? "bg-success/10 text-success" :
                      w.status === "pending" ? "bg-warning/10 text-warning" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {w.status === "completed" ? "Selesai" : w.status === "pending" ? "Menunggu" : "Ditolak"}
                    </span>
                    <p className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString("id-ID")}</p>
                  </div>
                </div>
                {w.status === "pending" && (
                  <div className="flex gap-1">
                    <button onClick={() => handleUpdateStatus(w.id, "completed")} className="rounded p-1.5 text-success hover:bg-success/10">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleUpdateStatus(w.id, "rejected")} className="rounded p-1.5 text-destructive hover:bg-destructive/10">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent earnings */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Pendapatan Terbaru</h3>
        {earnings.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Belum ada pendapatan</p>
        ) : (
          <div className="space-y-2">
            {earnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg bg-background p-3">
                <div>
                  <p className="text-xs font-medium text-foreground">{e.description}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleString("id-ID")}</p>
                </div>
                <span className="text-sm font-bold text-success">+{e.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EarningsManager;
