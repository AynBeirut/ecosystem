// Insert into activity_logs (best-effort, never throws)
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";

export type ActivityAction =
  | "invoice_paid" | "member_invited" | "role_changed"
  | "payment_method_updated" | "org_switched" | "plan_upgraded";

export async function logActivity(params: {
  organizationId: string;
  action: ActivityAction | string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_logs").insert({
      organization_id: params.organizationId,
      user_id: user.id,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      details: params.details ?? {},
    } as any);
  } catch (e) {
    logError("activityLog", "insert failed", e);
  }
}
