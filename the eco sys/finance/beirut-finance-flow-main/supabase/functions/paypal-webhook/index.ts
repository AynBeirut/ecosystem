// PayPal webhook — verifies signatures via PayPal verify-webhook-signature API.
// Requires PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_WEBHOOK_ID env vars.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PP_CLIENT = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PP_SECRET = Deno.env.get("PAYPAL_SECRET") || "";
const PP_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") || "";
const PP_BASE = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.paypal.com";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function ppToken(): Promise<string | null> {
  if (!PP_CLIENT || !PP_SECRET) return null;
  const r = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${PP_CLIENT}:${PP_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.access_token ?? null;
}

async function verifySig(req: Request, body: string): Promise<boolean> {
  if (!PP_WEBHOOK_ID) return false;
  const token = await ppToken();
  if (!token) return false;
  const payload = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
    webhook_id: PP_WEBHOOK_ID,
    webhook_event: JSON.parse(body),
  };
  const r = await fetch(`${PP_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return false;
  const j = await r.json();
  return j.verification_status === "SUCCESS";
}

async function logEvent(row: {
  organization_id?: string | null; invoice_id?: string | null;
  event_type: string; status: string; payload: unknown; error?: string | null;
}) {
  try {
    await admin.from("payment_audit_logs").insert({
      organization_id: row.organization_id ?? null,
      invoice_id: row.invoice_id ?? null,
      provider: "paypal",
      event_type: row.event_type,
      status: row.status,
      payload: row.payload ?? {},
      error: row.error ?? null,
    });
  } catch (e) { console.error("[paypal-webhook] audit log failed", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const raw = await req.text();
  const valid = await verifySig(req, raw);
  if (!valid) {
    await logEvent({ event_type: "signature_invalid", status: "error", payload: { headers: Object.fromEntries(req.headers) } });
    return new Response("invalid signature", { status: 400, headers: corsHeaders });
  }

  let event: any;
  try { event = JSON.parse(raw); }
  catch {
    await logEvent({ event_type: "parse_error", status: "error", payload: { raw: raw.slice(0, 500) } });
    return new Response("bad json", { status: 400, headers: corsHeaders });
  }

  const type = event?.event_type as string;
  const resource = event?.resource ?? {};
  const invoiceId = resource?.custom_id || resource?.invoice_id || resource?.purchase_units?.[0]?.custom_id || null;

  await logEvent({ invoice_id: invoiceId, event_type: type, status: "received", payload: event });

  try {
    if (!invoiceId) {
      await logEvent({ event_type: type, status: "skipped_no_invoice", payload: {} });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    const { data: inv } = await admin.from("invoices")
      .select("id,status,payment_verified,organization_id").eq("id", invoiceId).maybeSingle();
    if (!inv) {
      await logEvent({ invoice_id: invoiceId, event_type: type, status: "invoice_not_found", payload: {} });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (type === "PAYMENT.CAPTURE.COMPLETED") {
      if (inv.status === "paid" && inv.payment_verified) {
        await logEvent({ invoice_id: invoiceId, organization_id: inv.organization_id, event_type: type, status: "already_paid", payload: {} });
      } else {
        const { error: upErr } = await admin.from("invoices").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_verified: true,
          payment_provider: "paypal",
          payment_reference: resource?.id ?? null,
        }).eq("id", invoiceId);
        await logEvent({
          invoice_id: invoiceId, organization_id: inv.organization_id,
          event_type: type, status: upErr ? "update_failed" : "marked_paid",
          payload: {}, error: upErr?.message,
        });
      }
    } else if (type === "PAYMENT.CAPTURE.DENIED") {
      const { error: upErr } = await admin.from("invoices")
        .update({ status: "payment_failed", payment_provider: "paypal" }).eq("id", invoiceId);
      await logEvent({
        invoice_id: invoiceId, organization_id: inv.organization_id,
        event_type: type, status: upErr ? "update_failed" : "marked_failed",
        payload: {}, error: upErr?.message,
      });
    } else {
      await logEvent({ invoice_id: invoiceId, organization_id: inv.organization_id, event_type: type, status: "ignored", payload: {} });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await logEvent({ invoice_id: invoiceId, event_type: type, status: "exception", payload: {}, error: (e as Error).message });
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
