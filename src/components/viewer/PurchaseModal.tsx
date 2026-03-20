import { motion } from "framer-motion";
import { MessageCircle, Upload, CheckCircle, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Show } from "@/types/show";

interface PurchaseModalProps {
  show: Show;
  purchaseStep: "qris" | "upload" | "info" | "done";
  uploadingProof: boolean;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  onClose: () => void;
  onConfirmRegular: () => void;
  onUploadProof: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitSubscription: () => void;
}

const PurchaseModal = ({
  show, purchaseStep, uploadingProof, phone, setPhone, email, setEmail,
  onClose, onConfirmRegular, onUploadProof, onSubmitSubscription,
}: PurchaseModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md tv:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 tv:p-10"
    >
      <h3 className="mb-1 text-lg font-bold text-foreground tv:text-2xl">{show.title}</h3>
      <p className="mb-4 text-sm text-muted-foreground tv:text-base">{show.price}</p>

      {/* Regular show: QRIS + WhatsApp */}
      {!show.is_subscription && purchaseStep === "info" && (
        <div className="space-y-4 tv:space-y-6">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 tv:p-6">
            <p className="text-sm text-muted-foreground tv:text-base">
              Silakan scan QRIS di bawah, lalu kirim bukti transfer secara manual ke admin via WhatsApp.
            </p>
          </div>
          {show.qris_image_url ? (
            <img src={show.qris_image_url} alt="QRIS" className="mx-auto w-full max-w-sm rounded-lg object-contain" />
          ) : (
            <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground tv:text-base tv:p-12">
              QRIS belum tersedia
            </div>
          )}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground tv:text-sm">
              <Mail className="h-3.5 w-3.5" /> Email Anda
            </label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="bg-background tv:h-12 tv:text-base" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 tv:p-5">
            <p className="mb-2 text-xs font-semibold text-foreground tv:text-sm">📋 Ringkasan Pesanan</p>
            <div className="space-y-1 text-xs text-muted-foreground tv:text-sm">
              <p>🎭 {show.title}</p>
              <p>💰 {show.price}</p>
              {show.schedule_date && <p>📅 {show.schedule_date} {show.schedule_time}</p>}
              {show.lineup && <p>👥 {show.lineup}</p>}
            </div>
          </div>
          <Button onClick={onConfirmRegular} disabled={!email.trim()} className="w-full gap-2 bg-success hover:bg-success/90 text-primary-foreground tv:py-6 tv:text-lg">
            <MessageCircle className="h-4 w-4 tv:h-6 tv:w-6" /> Kirim Pesanan via WhatsApp
          </Button>
          <p className="text-[10px] text-center text-muted-foreground tv:text-xs">
            * Anda akan diarahkan ke WhatsApp untuk mengirim data pesanan dan bukti transfer secara manual ke admin
          </p>
        </div>
      )}

      {/* Subscription: QRIS + upload */}
      {show.is_subscription && purchaseStep === "qris" && (
        <div className="space-y-4 tv:space-y-6">
          <p className="text-sm text-muted-foreground tv:text-base">Silakan scan QRIS di bawah untuk melakukan pembayaran:</p>
          {show.qris_image_url ? (
            <img src={show.qris_image_url} alt="QRIS" className="mx-auto w-full max-w-sm rounded-lg object-contain" />
          ) : (
            <div className="rounded-lg border border-border bg-secondary/50 p-8 text-center text-sm text-muted-foreground tv:text-base tv:p-12">QRIS belum tersedia</div>
          )}
          <p className="text-xs text-muted-foreground text-center tv:text-sm">Setelah melakukan pembayaran, upload bukti transfer:</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-4 tv:py-6 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10 tv:text-base">
            <Upload className="h-4 w-4 tv:h-6 tv:w-6" />
            {uploadingProof ? "Mengupload..." : "Upload Bukti Pembayaran"}
            <input type="file" accept="image/*" className="hidden" onChange={onUploadProof} />
          </label>
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

export default PurchaseModal;
