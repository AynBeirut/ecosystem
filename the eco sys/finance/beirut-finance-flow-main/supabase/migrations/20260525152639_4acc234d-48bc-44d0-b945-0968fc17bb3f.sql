
-- 1) organizations INSERT: require authenticated uid (no more bare true)
DROP POLICY IF EXISTS "Any authenticated can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 2) activity_logs: split ALL into SELECT + INSERT only (no UPDATE/DELETE for members)
DROP POLICY IF EXISTS "Org members manage activity_logs" ON public.activity_logs;
CREATE POLICY "Org members read activity_logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "Org members insert activity_logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT user_org_ids())
  AND user_id = auth.uid()
);
-- No UPDATE/DELETE policies => denied by default for authenticated role

-- 3) psa_audit_logs: read-only for members; writes only via service role
DROP POLICY IF EXISTS "Org members manage psa_audit_logs" ON public.psa_audit_logs;
CREATE POLICY "Org members read psa_audit_logs"
ON public.psa_audit_logs
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT user_org_ids()));
-- No INSERT/UPDATE/DELETE => denied for authenticated; service_role bypasses RLS
