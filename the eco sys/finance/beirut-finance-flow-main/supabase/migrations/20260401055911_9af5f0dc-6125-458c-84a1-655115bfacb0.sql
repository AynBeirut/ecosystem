
DROP POLICY IF EXISTS "Members can access own organizations" ON public.organizations;
CREATE POLICY "Members can access own organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (id IN (SELECT public.user_org_ids()))
  WITH CHECK (id IN (SELECT public.user_org_ids()));
