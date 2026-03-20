import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

const ConnectionStatus = () => {
  const [status, setStatus] = useState<"connected" | "reconnecting" | "disconnected">("connected");
  const [visible, setVisible] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Monitor a heartbeat channel
    const channel = supabase.channel("connection-monitor");
    channelRef.current = channel;

    channel
      .on("system", { event: "*" } as any, (payload: any) => {
        // Supabase realtime system events
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("connected");
          setVisible(true);
          clearTimeout(hideTimeout.current);
          hideTimeout.current = setTimeout(() => setVisible(false), 2000);
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("disconnected");
          setVisible(true);
        } else if (s === "CLOSED") {
          setStatus("disconnected");
          setVisible(true);
        }
      });

    // Online/offline detection
    const handleOnline = () => {
      setStatus("reconnecting");
      setVisible(true);
      // Try to re-subscribe
      channel.subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("connected");
          clearTimeout(hideTimeout.current);
          hideTimeout.current = setTimeout(() => setVisible(false), 2000);
        }
      });
    };

    const handleOffline = () => {
      setStatus("disconnected");
      setVisible(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(hideTimeout.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      supabase.removeChannel(channel);
    };
  }, []);

  if (!visible) return null;

  const config = {
    connected: {
      icon: <Wifi className="h-3 w-3" />,
      text: "Terhubung",
      bg: "bg-success/90",
      textColor: "text-success-foreground",
    },
    reconnecting: {
      icon: <RefreshCw className="h-3 w-3 animate-spin" />,
      text: "Menghubungkan ulang...",
      bg: "bg-warning/90",
      textColor: "text-warning-foreground",
    },
    disconnected: {
      icon: <WifiOff className="h-3 w-3" />,
      text: "Koneksi terputus",
      bg: "bg-destructive/90",
      textColor: "text-destructive-foreground",
    },
  }[status];

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center py-1 ${config.bg} ${config.textColor} text-[11px] font-medium backdrop-blur-sm transition-all duration-300`}>
      <div className="flex items-center gap-1.5">
        {config.icon}
        {config.text}
      </div>
    </div>
  );
};

export default ConnectionStatus;
