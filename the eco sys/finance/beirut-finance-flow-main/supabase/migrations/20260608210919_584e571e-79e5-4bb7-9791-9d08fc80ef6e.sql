
-- 1. Helper: does the current user have one of the given roles in the org?
CREATE OR REPLACE FUNCTION public.user_has_org_role(_org_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = auth.uid()
      AND role = ANY(_roles)
  )
$$;

-- 2. Immutability trigger function for organization_id
CREATE OR REPLACE FUNCTION public.prevent_org_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable and cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

-- Attach trigger to all four tables
DROP TRIGGER IF EXISTS lock_org_id ON public.projects;
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_reassignment();

DROP TRIGGER IF EXISTS lock_org_id ON public.tasks;
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_reassignment();

DROP TRIGGER IF EXISTS lock_org_id ON public.proposals;
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_reassignment();

DROP TRIGGER IF EXISTS lock_org_id ON public.timesheets;
CREATE TRIGGER lock_org_id BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_reassignment();

-- 3. Split RLS by command with role enforcement
-- PROJECTS
DROP POLICY IF EXISTS "Org members manage projects" ON public.projects;
CREATE POLICY "Org members read projects" ON public.projects
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY "Managers insert projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Managers update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']))
  WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Managers delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));

-- TASKS
DROP POLICY IF EXISTS "Org members manage tasks" ON public.tasks;
CREATE POLICY "Org members read tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY "Managers insert tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Managers update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']))
  WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Managers delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));

-- PROPOSALS
DROP POLICY IF EXISTS "Org members manage proposals" ON public.proposals;
CREATE POLICY "Org members read proposals" ON public.proposals
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY "Managers insert proposals" ON public.proposals
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Managers update proposals" ON public.proposals
  FOR UPDATE TO authenticated
  USING (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']))
  WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));
CREATE POLICY "Managers delete proposals" ON public.proposals
  FOR DELETE TO authenticated
  USING (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager']));

-- TIMESHEETS
DROP POLICY IF EXISTS "Org members manage timesheets" ON public.timesheets;
CREATE POLICY "Org members read timesheets" ON public.timesheets
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY "Agents insert timesheets" ON public.timesheets
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']));
CREATE POLICY "Agents update timesheets" ON public.timesheets
  FOR UPDATE TO authenticated
  USING (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']))
  WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent']));
CREATE POLICY "Admins delete timesheets" ON public.timesheets
  FOR DELETE TO authenticated
  USING (public.user_has_org_role(organization_id, ARRAY['owner','admin']));
