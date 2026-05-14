import { Copy, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Props {
  replayModal: { showId: string; password: string } | null;
  onClose: () => void;
}

const ReplayPasswordDialog = ({ replayModal, onClose }: Props) => {
  const { toast } = useToast();

  return (
    <Dialog open={!!replayModal} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-warning" /> Sandi Replay</DialogTitle>
          <DialogDescription>Salin sandi ini sebelum menuju halaman replay</DialogDescription>
        </DialogHeader>
        {replayModal && (
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">🔐 Sandi Replay</p>
              <p className="font-mono text-2xl font-bold text-warning">{replayModal.password}</p>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(replayModal.password);
                toast({ title: "Sandi disalin! Membuka halaman replay..." });
                setTimeout(() => {
                  window.open("https://replaytime.lovable.app", "_blank");
                  onClose();
                }, 500);
              }}
            >
              <Copy className="h-4 w-4" /> Salin Sandi & Tonton Replay
            </Button>
            <p className="text-xs text-muted-foreground">⚠️ Sandi akan disalin otomatis, lalu halaman replay terbuka</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReplayPasswordDialog;
