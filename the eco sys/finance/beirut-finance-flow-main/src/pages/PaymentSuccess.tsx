import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

type State = "verifying" | "paid" | "timeout" | "missing";

const POLL_MS = 2000;
const TIMEOUT_MS = 60000;

const PaymentSuccess = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>("verifying");
  const invoiceId = params.get("invoice_id");
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!invoiceId) { setState("missing"); return; }
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      if (cancelled) return;
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select("status,payment_verified")
          .eq("id", invoiceId)
          .maybeSingle();
        if (error) logger.warn("PaymentSuccess", "poll error", error);
        if (data && (data as any).status === "paid" && (data as any).payment_verified) {
          setState("paid");
          window.setTimeout(() => navigate("/invoices"), 2500);
          return;
        }
      } catch (e) {
        logger.error("PaymentSuccess", "poll exception", e);
      }
      if (Date.now() - startedAt.current >= TIMEOUT_MS) { setState("timeout"); return; }
      timer = window.setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [invoiceId, navigate]);

  return (
    <AppLayout onLogout={() => supabase.auth.signOut()}>
      <div className="max-w-md mx-auto mt-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {state === "verifying" && <><Loader2 className="h-5 w-5 animate-spin" /> Verifying payment…</>}
              {state === "paid" && <><CheckCircle2 className="h-5 w-5 text-green-600" /> Payment Confirmed</>}
              {state === "timeout" && <><Clock className="h-5 w-5 text-yellow-600" /> Verification Pending</>}
              {state === "missing" && <><XCircle className="h-5 w-5 text-red-600" /> Missing Invoice</>}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            {state === "verifying" && <p>Waiting for payment processor confirmation. This can take a few seconds.</p>}
            {state === "paid" && <p>Your invoice has been marked as paid. Redirecting…</p>}
            {state === "timeout" && <p>Payment received. Verification is still pending. You can safely close this page — the invoice will update automatically once the processor confirms.</p>}
            {state === "missing" && <p>No invoice reference in the URL.</p>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PaymentSuccess;
