// Per-org BYOK Stripe Checkout Session creator.
// Reads org's Stripe secret key from payment_methods.config.secret_key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const invoice_id = String(body.invoice_id || "");
    const success_url = String(body.success_url || "");
    const cancel_url = String(body.cancel_url || "");
    if (!invoice_id || !success_url || !cancel_url) {
      return json({ error: "invoice_id, success_url, cancel_url required" }, 400);
    }

    // Validate redirect URLs against an allowlist to prevent open-redirect / phishing.
    const allowedOrigins = (Deno.env.get("APP_ALLOWED_ORIGINS") ||
      "https://beirut-finance-flow.lovable.app,https://id-preview--9db35d58-3cd1-45bf-95c7-65b74050595a.lovable.app")
      .split(",").map((s) => s.trim()).filter(Boolean);

    const isAllowed = (u: string) => {
      try {
        const origin = new URL(u).origin;
        return allowedOrigins.includes(origin);
      } catch { return false; }
    };
    if (!isAllowed(success_url) || !isAllowed(cancel_url)) {
      return json({ error: "Redirect URL not allowed" }, 400);
    }

    // Load invoice (RLS scopes by org membership)
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("id, organization_id, total, amount, currency, client_name")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr || !inv) return json({ error: "Invoice not found" }, 404);

    // Load active stripe payment method for this org
    const { data: pm, error: pmErr } = await supabase
      .from("payment_methods")
      .select("config, is_active")
      .eq("organization_id", inv.organization_id)
      .eq("type", "stripe")
      .eq("is_active", true)
      .maybeSingle();
    if (pmErr || !pm) return json({ error: "Stripe is not configured for this organization" }, 400);

    const secretKey = (pm.config as any)?.secret_key as string | undefined;
    if (!secretKey || !secretKey.startsWith("sk_")) {
      return json({ error: "Invalid Stripe secret key on payment method" }, 400);
    }

    const amount = Number(inv.total ?? inv.amount ?? 0);
    if (!amount || amount <= 0) return json({ error: "Invoice amount must be > 0" }, 400);

    const currency = String(inv.currency || "USD").toLowerCase();
    const unitAmount = Math.round(amount * 100); // cents

    // Create Checkout Session via Stripe REST API
    const form = new URLSearchParams();
    form.append("mode", "payment");
    form.append("success_url", success_url);
    form.append("cancel_url", cancel_url);
    form.append("client_reference_id", invoice_id);
    form.append("line_items[0][quantity]", "1");
    form.append("line_items[0][price_data][currency]", currency);
    form.append("line_items[0][price_data][unit_amount]", String(unitAmount));
    form.append(
      "line_items[0][price_data][product_data][name]",
      `Invoice ${invoice_id} — ${inv.client_name || ""}`.slice(0, 250),
    );
    form.append("metadata[invoice_id]", invoice_id);
    form.append("metadata[organization_id]", String(inv.organization_id));

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return json({ error: session?.error?.message || "Stripe error", details: session }, 400);
    }

    return json({ url: session.url, id: session.id }, 200);
  } catch (e) {
    console.error("[create-stripe-checkout]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
