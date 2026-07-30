
-- ============================================
-- PHASE 1: Projects, Proposals, Tasks, Timesheets, Currency
-- ============================================

-- 1. PROJECTS TABLE (central entity)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  client_id TEXT, -- references local client ID
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  budget NUMERIC(15,2),
  budget_currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. PROPOSALS TABLE
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id TEXT,
  client_name TEXT,
  title TEXT NOT NULL,
  rfp_text TEXT, -- extracted RFP content
  technical_response TEXT,
  scope_summary TEXT,
  deliverables JSONB DEFAULT '[]'::jsonb, -- array of deliverable objects
  timeline JSONB DEFAULT '[]'::jsonb, -- array of timeline milestones
  estimated_value NUMERIC(15,2),
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'converted')),
  converted_invoice_id TEXT, -- local invoice ID if converted
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposals" ON public.proposals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own proposals" ON public.proposals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proposals" ON public.proposals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own proposals" ON public.proposals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. TASKS TABLE
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT, -- staff ID from local storage
  assigned_name TEXT,
  deadline TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  linked_invoice_id TEXT, -- local invoice ID
  is_milestone BOOLEAN DEFAULT false,
  milestone_label TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. TIMESHEETS TABLE
CREATE TABLE public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL, -- local staff ID
  staff_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  rate NUMERIC(15,2) NOT NULL,
  rate_currency TEXT DEFAULT 'USD',
  description TEXT,
  is_billable BOOLEAN DEFAULT true,
  invoiced BOOLEAN DEFAULT false,
  invoice_id TEXT, -- local invoice ID once converted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timesheets" ON public.timesheets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own timesheets" ON public.timesheets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own timesheets" ON public.timesheets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own timesheets" ON public.timesheets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_timesheets_updated_at BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. CURRENCY SETTINGS TABLE
CREATE TABLE public.currency_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(20,6) NOT NULL,
  label TEXT, -- e.g. "Market Rate", "Official Rate"
  is_default BOOLEAN DEFAULT false,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, from_currency, to_currency, effective_date, label)
);

ALTER TABLE public.currency_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own currency settings" ON public.currency_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own currency settings" ON public.currency_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own currency settings" ON public.currency_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own currency settings" ON public.currency_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_currency_settings_updated_at BEFORE UPDATE ON public.currency_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_proposals_user_id ON public.proposals(user_id);
CREATE INDEX idx_proposals_project_id ON public.proposals(project_id);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_timesheets_user_id ON public.timesheets(user_id);
CREATE INDEX idx_timesheets_project_id ON public.timesheets(project_id);
CREATE INDEX idx_timesheets_staff_id ON public.timesheets(staff_id);
CREATE INDEX idx_currency_settings_user_id ON public.currency_settings(user_id);
