import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";

const ADMIN_WA = "6288809048431";
const MESSAGE = "Halo admin RealTime48, saya ingin bertanya.";

/**
 * Floating WhatsApp button — selalu menuju nomor admin resmi.
 * Disembunyikan pada halaman admin / reseller agar tidak mengganggu dashboard.
 */
const WhatsAppFab = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin") || pathname.startsWith("/reseller")) return null;

  const href = `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hubungi admin via WhatsApp"
      title="Hubungi admin via WhatsApp"
      className="fixed bottom-20 right-4 z-[60] md:bottom-6 md:right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] ring-2 ring-white/20 transition-transform hover:scale-110 active:scale-95"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-60 animate-ping" />
      <MessageCircle className="relative h-7 w-7" strokeWidth={2.5} />
    </a>
  );
};

export default WhatsAppFab;
