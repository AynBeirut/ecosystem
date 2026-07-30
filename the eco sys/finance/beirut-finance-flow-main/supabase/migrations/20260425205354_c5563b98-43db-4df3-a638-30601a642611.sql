CREATE TABLE IF NOT EXISTS public.psa_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  invoice_id text,
  timesheet_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.psa_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage psa_audit_logs"
ON public.psa_audit_logs
FOR ALL
TO authenticated
USING (organization_id IN (SELECT public.user_org_ids()))
WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE INDEX IF NOT EXISTS idx_psa_audit_logs_org ON public.psa_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_psa_audit_logs_invoice ON public.psa_audit_logs(invoice_id);