// Detects expired Firebase sessions and listens for sign-out
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { toast } from "sonner";
import { logError, logInfo } from "@/lib/logger";

export function useSessionGuard() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        logInfo("session", "signed out");
        return;
      }
      user.getIdTokenResult().then((token) => {
        const expMs = new Date(token.expirationTime).getTime() - Date.now();
        if (expMs < 5 * 60 * 1000) {
          logInfo("session", "token near expiry — Firebase auto-refresh active");
        }
      }).catch((e) => logError("session", "token check failed", e));
    });

    const onVisible = () => {
      if (document.visibilityState === "visible" && auth.currentUser) {
        auth.currentUser.getIdToken(true).catch((e) => {
          logError("session", "refresh failed", e);
          toast.error("Your session expired. Please sign in again.");
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      unsub();
    };
  }, []);
}
