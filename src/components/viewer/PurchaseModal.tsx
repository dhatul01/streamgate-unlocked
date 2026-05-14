import { motion } from "framer-motion";
import { MessageCircle, Upload, CheckCircle, Mail, Loader2, Copy, Radio, AlertTriangle, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Show } from "@/types/show";

interface PurchaseModalProps {
  show: Show;
  purchaseStep: "qris" | "upload" | "info" | "done" | "pakasir_qr" | "pakasir_done";
  uploadingProof: boolean;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  onClose: () => void;
  onConfirmRegular: () => void;
  onUploadProof: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitSubscription: () => void;
  pakasirLoading?: boolean;
  pakasirData?: { qr_string: string; total_payment: number; expires_at: string; order_id: string } | null;
  pakasirResult?: { token_code: string; show_title: string } | null;
  pakasirError?: string | null;
  pakasirAttempts?: number;
  onPakasirRetry?: () => void;
}

const PurchaseModal = ({
  show, purchaseStep, uploadingProof, phone, setPhone, email, setEmail,
  onClose, onConfirmRegular, onUploadProof, onSubmitSubscription,
  pakasirLoading, pakasirData, pakasirResult,
  pakasirError, pakasirAttempts, onPakasirRetry,
}: PurchaseModalProps) => {
  const { toast } = useToast();
  const liveLink = pakasirResult ? `${window.location.origin}/live?t=${pakasirResult.token_code}` : "";

  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md tv:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 tv:p-10"
    >
      <h3 className="mb-1 text-lg font-bold text-foreground tv:text-2xl">{show.title}</h3>
      <p className="mb-4 text-sm text-muted-foreground tv:text-base">{show.price}</p>

      {/* Regular show — Step 1: input HP + email */}
      {!show.is_subscription && purchaseStep === "info" && (
        <div className="space-y-4 tv:space-y-6">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 tv:p-6">
            <p className="text-sm text-muted-foreground tv:text-base">
              💳 Bayar otomatis via QRIS Pakasir. Token akan dikirim ke WhatsApp Anda setelah pembayaran terkonfirmasi.
            </p>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground tv:text-sm">
              <MessageCircle className="h-3.5 w-3.5" /> Nomor WhatsApp <span className="text-destructive">*</span>
            </label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="bg-background tv:h-12 tv:text-base" />
            <p className="mt-1 text-[10px] text-muted-foreground">Token live + info replay akan dikirim ke nomor ini.</p>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground tv:text-sm">
              <Mail className="h-3.5 w-3.5" /> Email (opsional)
            </label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="bg-background tv:h-12 tv:text-base" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 tv:p-5">
            <p className="mb-2 text-xs font-semibold text-foreground tv:text-sm">📋 Ringkasan</p>
            <div className="space-y-1 text-xs text-muted-foreground tv:text-sm">
              <p>🎭 {show.title}</p>
              <p>💰 {show.price}</p>
              {show.schedule_date && <p>📅 {show.schedule_date} {show.schedule_time}</p>}
            </div>
          </div>
          <Button onClick={onConfirmRegular} disabled={!phone.trim() || pakasirLoading} className="w-full gap-2 bg-success hover:bg-success/90 text-primary-foreground tv:py-6 tv:text-lg">
            {pakasirLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            {pakasirLoading ? "Membuat QRIS..." : "Lanjut Bayar via QRIS"}
          </Button>
        </div>
      )}

      {/* Pakasir Step 2: show QRIS dynamic */}
      {!show.is_subscription && purchaseStep === "pakasir_qr" && pakasirData && (
        <div className="space-y-4 text-center">
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
            <p className="text-xs text-muted-foreground">Total bayar</p>
            <p className="text-2xl font-bold text-warning">Rp {pakasirData.total_payment.toLocaleString("id-ID")}</p>
          </div>
          <div className="mx-auto inline-block rounded-xl bg-white p-4">
            <QRCodeSVG value={pakasirData.qr_string} size={220} level="M" />
          </div>
          <p className="text-sm text-foreground">Scan QRIS dengan aplikasi e-wallet / m-banking</p>
          <p className="text-xs text-muted-foreground">
            Order: <span className="font-mono">{pakasirData.order_id}</span>
          </p>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-left">
            <p className="text-xs text-muted-foreground">
              ⏳ Setelah membayar, token akan otomatis dikirim ke WhatsApp <span className="font-semibold text-foreground">{phone}</span>.
              Halaman ini akan update otomatis bila pembayaran terkonfirmasi.
            </p>
          </div>
        </div>
      )}

      {/* Pakasir Step 3: success */}
      {!show.is_subscription && purchaseStep === "pakasir_done" && pakasirResult && (
        <div className="space-y-4 text-center">
          <CheckCircle className="mx-auto h-14 w-14 text-success" />
          <h4 className="text-lg font-bold text-foreground">Pembayaran Berhasil!</h4>
          <p className="text-sm text-muted-foreground">Token sudah dikirim ke WhatsApp Anda.</p>
          <div className="rounded-lg bg-secondary p-4">
            <p className="text-xs text-muted-foreground mb-1">Token Akses</p>
            <p className="font-mono text-lg font-bold text-primary">{pakasirResult.token_code}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2"
              onClick={() => { navigator.clipboard.writeText(liveLink); toast({ title: "Link disalin!" }); }}>
              <Copy className="h-4 w-4" /> Salin Link
            </Button>
            <Button className="flex-1 gap-2" onClick={() => { window.location.href = liveLink; }}>
              <Radio className="h-4 w-4" /> Tonton
            </Button>
          </div>
        </div>
      )}

      {/* Subscription: QRIS + upload (unchanged) */}
      {show.is_subscription && purchaseStep === "qris" && (
        <div className="space-y-4 tv:space-y-6">
          <p className="text-sm text-muted-foreground tv:text-base">Silakan scan QRIS di bawah untuk melakukan pembayaran:</p>
          {show.qris_image_url ? (
            <img src={show.qris_image_url} alt="QRIS" className="mx-auto w-full max-w-sm rounded-lg object-contain" />
          ) : (
            <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground tv:text-base tv:p-12">QRIS belum tersedia</div>
          )}
          <p className="text-xs text-muted-foreground text-center tv:text-sm">Setelah melakukan pembayaran, upload bukti transfer:</p>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-4 tv:py-6 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10 tv:text-base"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*,.heic,.heif";
              input.capture = "environment";
              input.onchange = (e: any) => onUploadProof(e);
              input.click();
            }}
            disabled={uploadingProof}
          >
            <Upload className="h-4 w-4 tv:h-6 tv:w-6" />
            {uploadingProof ? "Mengupload..." : "Upload Bukti Pembayaran"}
          </button>
        </div>
      )}

      {purchaseStep === "info" && show.is_subscription && (
        <div className="space-y-4 tv:space-y-6">
          <div className="flex items-center gap-2 text-sm text-success tv:text-base">
            <CheckCircle className="h-4 w-4 tv:h-6 tv:w-6" /> Bukti pembayaran berhasil diupload
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground tv:text-sm">Nomor HP</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="bg-background tv:h-12 tv:text-base" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground tv:text-sm">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="bg-background tv:h-12 tv:text-base" />
          </div>
          <Button onClick={onSubmitSubscription} disabled={!phone || !email} className="w-full tv:py-6 tv:text-lg">
            Kirim Data Langganan
          </Button>
        </div>
      )}

      {purchaseStep === "done" && show.is_subscription && (
        <div className="space-y-4 tv:space-y-6 text-center">
          <CheckCircle className="mx-auto h-12 w-12 tv:h-16 tv:w-16 text-success" />
          <h4 className="text-lg font-bold text-foreground tv:text-2xl">Pendaftaran Berhasil!</h4>
          <p className="text-sm text-muted-foreground tv:text-base">Data dan bukti pembayaran Anda telah dikirim. Admin akan mengkonfirmasi pembayaran Anda.</p>
        </div>
      )}

      <button onClick={onClose} className="mt-4 w-full rounded-xl bg-secondary py-3 tv:py-4 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 tv:text-base">
        Tutup
      </button>
    </motion.div>
  </div>
  );
};

export default PurchaseModal;
