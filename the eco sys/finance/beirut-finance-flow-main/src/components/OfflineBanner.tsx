import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";

const OfflineBanner = () => {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const onOffline = () => { setOnline(false); toast.error("You're offline. Changes will sync when you reconnect."); };
    const onOnline = () => {
      setOnline(true);
      toast.success("Back online. Refreshing…");
      setTimeout(() => window.location.reload(), 800);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-destructive text-destructive-foreground text-sm py-2 px-4 flex items-center justify-center gap-2 shadow">
      <WifiOff className="h-4 w-4" /> You are offline. Reconnecting…
    </div>
  );
};

export default OfflineBanner;
