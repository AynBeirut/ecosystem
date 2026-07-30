// Detects expired sessions and triggers silent refresh
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logError, logInfo } from "@/lib/logger";

export function useSessionGuard() {
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const exp = (session.expires_at ?? 0) * 1000;
        const msLeft = exp - Date.now();
        if (msLeft < 5 * 60 * 1000) {
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            logError("session", "refresh failed", error);
            toast.error("Your session expired. Please sign in again.");
          } else {
            logInfo("session", "refreshed");
          }
        }
      } catch (e) {
        logError("session", "check failed", e);
      }
    };

    check();
    const id = setInterval(() => { if (!cancelled) check(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") logInfo("session", "token refreshed");
      if (event === "SIGNED_OUT") toast.info("You have been signed out.");
    });

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      sub.subscription.unsubscribe();
    };
  }, []);
}
