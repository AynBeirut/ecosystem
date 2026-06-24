
-- 1. Invoice payment hardening columns
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_verified_status
  ON public.invoices (payment_verified, status);

-- 2. Payment audit log table
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  invoice_id text,
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Org members can read their logs
CREATE POLICY "Org members read payment_audit_logs"
ON public.payment_audit_logs
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT user_org_ids()));

-- No client writes; only service role (webhooks) writes. (No INSERT policy = denied for authenticated)

CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_invoice
  ON public.payment_audit_logs (invoice_id, created_at DESC);
