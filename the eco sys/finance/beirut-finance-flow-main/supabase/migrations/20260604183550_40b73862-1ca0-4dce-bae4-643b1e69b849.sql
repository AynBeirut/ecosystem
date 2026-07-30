-- Step 1 of multi-step cross-org isolation rollout for projects/tasks/proposals/timesheets.
-- This migration ONLY adds a nullable organization_id column and backfills it from each
-- user's first organization membership. RLS policies are NOT changed in this step, so
-- existing CRUD continues to work unchanged. A later migration will swap policies to
-- organization_id IN (SELECT user_org_ids()) after the app starts writing organization_id.

-- 1. Add nullable organization_id columns (no FK to keep this non-blocking; FK can be added later)
ALTER TABLE public.projects   ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.tasks      ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.proposals  ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS organization_id uuid;

-- 2. Backfill organization_id from the owning user's first organization membership.
--    Safe: only updates rows where organization_id IS NULL.
UPDATE public.projects p
SET organization_id = m.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_members
  ORDER BY user_id, created_at ASC
) m
WHERE p.user_id = m.user_id AND p.organization_id IS NULL;

UPDATE public.tasks t
SET organization_id = m.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_members
  ORDER BY user_id, created_at ASC
) m
WHERE t.user_id = m.user_id AND t.organization_id IS NULL;

UPDATE public.proposals pr
SET organization_id = m.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_members
  ORDER BY user_id, created_at ASC
) m
WHERE pr.user_id = m.user_id AND pr.organization_id IS NULL;

UPDATE public.timesheets ts
SET organization_id = m.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_members
  ORDER BY user_id, created_at ASC
) m
WHERE ts.user_id = m.user_id AND ts.organization_id IS NULL;

-- 3. Helpful indexes for upcoming org-scoped policies
CREATE INDEX IF NOT EXISTS idx_projects_org   ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org      ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org  ON public.proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_org ON public.timesheets(organization_id);