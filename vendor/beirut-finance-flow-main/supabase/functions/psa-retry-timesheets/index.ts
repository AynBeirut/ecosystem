// PSA Retry Engine — re-links timesheets flagged needs_sync to their invoices.
// Runs as a scheduled job (cron). Service role bypasses RLS so it covers all orgs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    const secret = req.headers.get("x-internal-secret");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("PSA_RETRY_SECRET");
    const ok = (auth && auth === serviceKey) || (internalSecret && secret === internalSecret);
    if (!ok) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    const { data, error } = await supabase
      .from("timesheets")
      .select("id, invoice_id")
      .eq("needs_sync", true)
      .not("invoice_id", "is", null)
      .limit(200);

    if (error) {
      console.error("[psa-retry][fetch]", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groups = (data as any[]).reduce<Record<string, string[]>>((acc, row) => {
      const inv = row.invoice_id as string;
      if (!acc[inv]) acc[inv] = [];
      acc[inv].push(row.id);
      return acc;
    }, {});

    let succeeded = 0;
    let failed = 0;

    for (const invoiceId of Object.keys(groups)) {
      const ids = groups[invoiceId];
      const { error: linkErr } = await supabase
        .from("timesheets")
        .update({ invoiced: true })
        .in("id", ids)
        .eq("invoiced", false);

      if (linkErr) {
        console.error("[psa-retry][link]", invoiceId, linkErr);
        failed += ids.length;
        continue;
      }

      const { error: clearErr } = await supabase
        .from("timesheets")
        .update({ needs_sync: false })
        .in("id", ids);

      if (clearErr) {
        console.error("[psa-retry][clear]", invoiceId, clearErr);
        failed += ids.length;
      } else {
        succeeded += ids.length;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: data.length, succeeded, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[psa-retry][crash]", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
