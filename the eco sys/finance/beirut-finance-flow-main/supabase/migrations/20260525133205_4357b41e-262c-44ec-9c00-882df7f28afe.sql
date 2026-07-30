
-- 1. Fix org_members privilege escalation: only allow self-insert when bootstrapping a brand-new org (no existing members), and only as 'owner'.
DROP POLICY IF EXISTS "Owners or self can insert memberships" ON public.organization_members;

CREATE POLICY "Owners add members or self bootstrap new org"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_owner(organization_id)
  OR (
    user_id = auth.uid()
    AND role = 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organization_members.organization_id
    )
  )
);

-- 2. Restrict payment_methods SELECT to roles with manage_payment_methods permission (credentials in config).
DROP POLICY IF EXISTS "Org members read payment_methods" ON public.payment_methods;

CREATE POLICY "Privileged roles read payment_methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (public.has_permission('manage_payment_methods', organization_id));

-- 3. Set immutable search_path on org_seat_limit.
ALTER FUNCTION public.org_seat_limit(text) SET search_path = public;

-- 4. Revoke EXECUTE on internal SECURITY DEFINER functions from anon. They are only needed by authenticated RLS contexts.
REVOKE EXECUTE ON FUNCTION public.has_permission(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_org_ids() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lookup_user_id_by_email(text) FROM anon, public;
