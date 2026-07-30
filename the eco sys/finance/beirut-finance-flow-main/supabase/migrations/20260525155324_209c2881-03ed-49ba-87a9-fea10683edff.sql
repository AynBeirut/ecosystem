-- 1) Tighten expenses access to privileged roles only
DROP POLICY IF EXISTS "Org members manage expenses" ON public.expenses;

CREATE POLICY "Privileged roles read expenses"
ON public.expenses FOR SELECT TO authenticated
USING (public.has_permission('manage_invoices', organization_id));

CREATE POLICY "Privileged roles insert expenses"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (public.has_permission('manage_invoices', organization_id));

CREATE POLICY "Privileged roles update expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (public.has_permission('manage_invoices', organization_id))
WITH CHECK (public.has_permission('manage_invoices', organization_id));

CREATE POLICY "Privileged roles delete expenses"
ON public.expenses FOR DELETE TO authenticated
USING (public.has_permission('manage_invoices', organization_id));

-- 2) Activity logs: enforce append-only via explicit revokes from authenticated role
-- No UPDATE/DELETE policies exist, so RLS already denies these for authenticated users.
-- Belt-and-suspenders: revoke direct table privileges so even a future permissive policy
-- cannot grant UPDATE/DELETE without an explicit GRANT.
REVOKE UPDATE, DELETE ON public.activity_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.activity_logs FROM anon;