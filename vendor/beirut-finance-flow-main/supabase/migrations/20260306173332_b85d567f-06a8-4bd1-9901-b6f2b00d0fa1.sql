
-- Drop ALL restrictive policies and recreate as permissive

-- proposals
DROP POLICY IF EXISTS "Users can create own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can view own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can update own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can delete own proposals" ON public.proposals;

CREATE POLICY "Select own proposals" ON public.proposals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own proposals" ON public.proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own proposals" ON public.proposals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own proposals" ON public.proposals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Select own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- tasks
DROP POLICY IF EXISTS "Users can create own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Select own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- timesheets
DROP POLICY IF EXISTS "Users can create own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users can view own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users can update own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users can delete own timesheets" ON public.timesheets;

CREATE POLICY "Select own timesheets" ON public.timesheets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own timesheets" ON public.timesheets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own timesheets" ON public.timesheets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own timesheets" ON public.timesheets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- currency_settings
DROP POLICY IF EXISTS "Users can create own currency settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Users can view own currency settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Users can update own currency settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Users can delete own currency settings" ON public.currency_settings;

CREATE POLICY "Select own currency_settings" ON public.currency_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own currency_settings" ON public.currency_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own currency_settings" ON public.currency_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own currency_settings" ON public.currency_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_backups
DROP POLICY IF EXISTS "Users can create their own backup" ON public.user_backups;
DROP POLICY IF EXISTS "Users can view their own backup" ON public.user_backups;
DROP POLICY IF EXISTS "Users can update their own backup" ON public.user_backups;
DROP POLICY IF EXISTS "Users can delete their own backup" ON public.user_backups;

CREATE POLICY "Select own backups" ON public.user_backups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own backups" ON public.user_backups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own backups" ON public.user_backups FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own backups" ON public.user_backups FOR DELETE TO authenticated USING (auth.uid() = user_id);
