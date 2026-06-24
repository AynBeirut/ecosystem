
-- Backfill any rows missing organization_id (from user's first org membership)
UPDATE public.proposals p
SET organization_id = om.organization_id
FROM (SELECT DISTINCT ON (user_id) user_id, organization_id FROM public.organization_members ORDER BY user_id) om
WHERE p.organization_id IS NULL AND p.user_id = om.user_id;

UPDATE public.projects p
SET organization_id = om.organization_id
FROM (SELECT DISTINCT ON (user_id) user_id, organization_id FROM public.organization_members ORDER BY user_id) om
WHERE p.organization_id IS NULL AND p.user_id = om.user_id;

UPDATE public.tasks p
SET organization_id = om.organization_id
FROM (SELECT DISTINCT ON (user_id) user_id, organization_id FROM public.organization_members ORDER BY user_id) om
WHERE p.organization_id IS NULL AND p.user_id = om.user_id;

UPDATE public.timesheets p
SET organization_id = om.organization_id
FROM (SELECT DISTINCT ON (user_id) user_id, organization_id FROM public.organization_members ORDER BY user_id) om
WHERE p.organization_id IS NULL AND p.user_id = om.user_id;

-- Delete any remaining orphans (user has no org membership) so NOT NULL can apply
DELETE FROM public.proposals WHERE organization_id IS NULL;
DELETE FROM public.projects WHERE organization_id IS NULL;
DELETE FROM public.tasks WHERE organization_id IS NULL;
DELETE FROM public.timesheets WHERE organization_id IS NULL;

-- Enforce NOT NULL
ALTER TABLE public.projects ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.proposals ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.timesheets ALTER COLUMN organization_id SET NOT NULL;

-- Swap RLS policies: org-scoped, permissive (matches rest of schema)
DROP POLICY IF EXISTS "Users manage own projects" ON public.projects;
CREATE POLICY "Org members manage projects" ON public.projects
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;
CREATE POLICY "Org members manage tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own proposals" ON public.proposals;
CREATE POLICY "Org members manage proposals" ON public.proposals
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own timesheets" ON public.timesheets;
CREATE POLICY "Org members manage timesheets" ON public.timesheets
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));
