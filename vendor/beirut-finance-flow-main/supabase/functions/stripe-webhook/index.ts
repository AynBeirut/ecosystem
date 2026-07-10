// Stripe webhook — authoritative source of truth for invoice payment state.
// Verifies signature with STRIPE_WEBHOOK_SECRET, then marks invoices paid/failed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function verifySig(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
    const t = parts["t"]; const v1 = parts["v1"];
    if (!t || !v1 || !secret) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    // constant-time compare
    if (hex.length !== v1.length) return false;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

async function logEvent(row: {
  organization_id?: string | null; invoice_id?: string | null;
  event_type: string; status: string; payload: unknown; error?: string | null;
}) {
  try {
    await admin.from("payment_audit_logs").insert({
      organization_id: row.organization_id ?? null,
      invoice_id: row.invoice_id ?? null,
      provider: "stripe",
      event_type: row.event_type,
      status: row.status,
      payload: row.payload ?? {},
      error: row.error ?? null,
    });
  } catch (e) { console.error("[stripe-webhook] audit log failed", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();

  if (!WEBHOOK_SECRET) {
    await logEvent({ event_type: "config_missing", status: "error", payload: { msg: "STRIPE_WEBHOOK_SECRET not set" } });
    return new Response("webhook secret missing", { status: 500, headers: corsHeaders });
  }
  const valid = await verifySig(raw, sig, WEBHOOK_SECRET);
  if (!valid) {
    await logEvent({ event_type: "signature_invalid", status: "error", payload: { sig } });
    return new Response("invalid signature", { status: 400, headers: corsHeaders });
  }

  let event: any;
  try { event = JSON.parse(raw); }
  catch {
    await logEvent({ event_type: "parse_error", status: "error", payload: { raw: raw.slice(0, 500) } });
    return new Response("bad json", { status: 400, headers: corsHeaders });
  }

  const type = event?.type as string;
  const obj = event?.data?.object ?? {};
  const invoiceId =
    obj?.metadata?.invoice_id ||
    obj?.client_reference_id ||
    obj?.payment_intent?.metadata?.invoice_id ||
    null;
  const orgId = obj?.metadata?.organization_id || null;

  await logEvent({ organization_id: orgId, invoice_id: invoiceId, event_type: type, status: "received", payload: event });

  try {
    if (!invoiceId) {
      await logEvent({ event_type: type, status: "skipped_no_invoice", payload: {} });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const { data: inv, error: invErr } = await admin
      .from("invoices").select("id,status,payment_verified,organization_id")
      .eq("id", invoiceId).maybeSingle();
    if (invErr || !inv) {
      await logEvent({ invoice_id: invoiceId, event_type: type, status: "invoice_not_found", payload: {}, error: invErr?.message });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (type === "checkout.session.completed" || type === "payment_intent.succeeded") {
      if (inv.status === "paid" && inv.payment_verified) {
        await logEvent({ invoice_id: invoiceId, organization_id: inv.organization_id, event_type: type, status: "already_paid", payload: {} });
      } else {
        const { error: upErr } = await admin.from("invoices").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_verified: true,
          payment_provider: "stripe",
          payment_reference: obj?.id ?? obj?.payment_intent ?? null,
        }).eq("id", invoiceId);
        await logEvent({
          invoice_id: invoiceId, organization_id: inv.organization_id,
          event_type: type, status: upErr ? "update_failed" : "marked_paid",
          payload: {}, error: upErr?.message,
        });
      }
    } else if (type === "payment_intent.payment_failed") {
      const { error: upErr } = await admin.from("invoices")
        .update({ status: "payment_failed", payment_provider: "stripe" }).eq("id", invoiceId);
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
