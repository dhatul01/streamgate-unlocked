import { ShieldAlert } from "lucide-react";

interface BannedScreenProps {
  ip?: string;
  reason?: string;
  blockedAt?: string;
}

const BannedScreen = ({ ip, reason, blockedAt }: BannedScreenProps) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Akses Diblokir</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Maaf, akses Anda ke RealTime48 telah diblokir oleh administrator.
        </p>
        {reason && (
          <div className="mb-3 rounded-lg border border-border bg-background p-3 text-left">
            <p className="text-xs font-semibold text-muted-foreground">Alasan</p>
            <p className="text-sm text-foreground">{reason}</p>
          </div>
        )}
        {ip && (
          <p className="text-xs text-muted-foreground">
            IP: <span className="font-mono text-foreground">{ip}</span>
          </p>
        )}
        {blockedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Diblokir pada {new Date(blockedAt).toLocaleString("id-ID")}
          </p>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          Jika menurut Anda ini adalah kesalahan, hubungi admin melalui WhatsApp.
        </p>
      </div>
    </div>
  );
};

export default BannedScreen;
