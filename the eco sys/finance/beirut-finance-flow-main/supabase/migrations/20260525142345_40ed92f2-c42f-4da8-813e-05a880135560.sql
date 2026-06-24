
DROP POLICY IF EXISTS "Members can access own organizations" ON public.organizations;

CREATE POLICY "Members view own organizations"
ON public.organizations FOR SELECT TO authenticated
USING (id IN (SELECT user_org_ids()));

CREATE POLICY "Any authenticated can create organizations"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Only owners update organizations"
ON public.organizations FOR UPDATE TO authenticated
USING (public.is_org_owner(id))
WITH CHECK (public.is_org_owner(id));

CREATE POLICY "Only owners delete organizations"
ON public.organizations FOR DELETE TO authenticated
USING (public.is_org_owner(id));
