import { useState } from "react";
import { CheckCircle, Coins, Copy, Radio, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Show } from "@/types/show";

export interface CoinResult {
  token_code: string;
  remaining_balance: number;
  replay_password?: string;
  access_password?: string;
}

interface Props {
  coinShowTarget: Show | null;
  onClose: () => void;
  coinResult: CoinResult | null;
  coinBalance: number;
  coinRedeeming: boolean;
  onRedeem: (phone: string) => void;
}

const CoinPurchaseDialog = ({ coinShowTarget, onClose, coinResult, coinBalance, coinRedeeming, onRedeem }: Props) => {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const phoneValid = cleanPhone.length >= 8;

  return (
    <Dialog open={!!coinShowTarget} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>🪙 Beli dengan Koin</DialogTitle>
          <DialogDescription>{coinShowTarget?.title}</DialogDescription>
        </DialogHeader>
        {!coinResult ? (
          <div className="space-y-4">
            {coinShowTarget?.qris_image_url && (
              <div className="text-center">
                <p className="text-xs font-medium text-muted-foreground mb-2">📱 Scan QRIS untuk pembayaran</p>
                <img src={coinShowTarget.qris_image_url} alt="QRIS" className="mx-auto max-h-48 rounded-lg object-contain" />
              </div>
            )}
            <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Show</span>
                <span className="font-semibold text-foreground">{coinShowTarget?.title}</span>
              </div>
              {coinShowTarget?.schedule_date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Jadwal</span>
                  <span className="text-foreground">{coinShowTarget.schedule_date} {coinShowTarget.schedule_time}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Harga</span>
                <span className="font-bold text-warning">{coinShowTarget?.coin_price} Koin</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">Saldo Anda</span>
                <span className={`font-bold ${coinBalance >= (coinShowTarget?.coin_price || 0) ? "text-success" : "text-destructive"}`}>
                  {coinBalance} Koin
                </span>
              </div>
            </div>
            {coinBalance < (coinShowTarget?.coin_price || 0) ? (
              <div className="space-y-3">
                <p className="text-center text-sm text-destructive">Koin tidak cukup untuk membeli show ini.</p>
                <Button className="w-full" variant="outline" onClick={() => { onClose(); window.location.href = "/coins"; }}>
                  <Coins className="mr-2 h-4 w-4" /> Beli Koin
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" /> Nomor WhatsApp <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    inputMode="tel"
                    className="bg-background"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Token live + info replay akan dikirim ke nomor WhatsApp ini.
                  </p>
                </div>
                <Button className="w-full gap-2" onClick={() => onRedeem(cleanPhone)} disabled={coinRedeeming || !phoneValid}>
                  <Coins className="h-4 w-4" />
                  {coinRedeeming ? "Memproses..." : `Bayar ${coinShowTarget?.coin_price} Koin`}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-success" />
            <p className="font-semibold text-foreground">Pembelian Berhasil!</p>
            <p className="text-sm text-muted-foreground">Gunakan token ini untuk menonton show</p>
            <div className="rounded-lg bg-secondary p-4">
              <p className="font-mono text-lg font-bold text-primary">{coinResult.token_code}</p>
            </div>
            {coinResult.replay_password && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">🔐 Sandi Replay</p>
                <p className="font-mono text-lg font-bold text-warning">{coinResult.replay_password}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Simpan sandi ini untuk akses replay setelah show selesai</p>
              </div>
            )}
            {coinResult.access_password && (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">🔐 Sandi Akses Show</p>
                <p className="font-mono text-lg font-bold text-primary">{coinResult.access_password}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Sandi ini akan ditampilkan di kartu show Anda</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/live?t=${coinResult.token_code}`);
                  toast({ title: "Link disalin!" });
                }}
              >
                <Copy className="h-4 w-4" /> Salin Link
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => { window.location.href = `/live?t=${coinResult.token_code}`; }}
              >
                <Radio className="h-4 w-4" /> Tonton Sekarang
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Sisa saldo: <span className="font-bold text-warning">{coinResult.remaining_balance} koin</span></p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CoinPurchaseDialog;
