-- Prevent client-side plan upgrades. Only service_role (webhooks/edge functions) can change plan.
CREATE OR REPLACE FUNCTION public.prevent_client_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Plan changes must be processed through verified payment. Contact support to upgrade.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_prevent_plan_change ON public.organizations;
CREATE TRIGGER organizations_prevent_plan_change
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_plan_change();