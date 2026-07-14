
-- ===== 20251125102430_142ed6ac-b40d-4eeb-adb7-95b827c3a91d.sql =====
-- Create user_backups table for encrypted cloud sync data
CREATE TABLE public.user_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_backups ENABLE ROW LEVEL SECURITY;

-- Users can only view their own backup
CREATE POLICY "Users can view their own backup" 
ON public.user_backups 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own backup
CREATE POLICY "Users can create their own backup" 
ON public.user_backups 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own backup
CREATE POLICY "Users can update their own backup" 
ON public.user_backups 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own backup
CREATE POLICY "Users can delete their own backup" 
ON public.user_backups 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_backups_updated_at
BEFORE UPDATE ON public.user_backups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260301123343_82f918a2-838c-4922-b720-9cda7a79330f.sql =====

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


-- ===== 20260305170618_d8aa2df9-1079-4391-a3ba-f0fa85c86127.sql =====
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE for all tables

-- proposals
DROP POLICY IF EXISTS "Users can create own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can view own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can update own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can delete own proposals" ON public.proposals;
CREATE POLICY "Users can create own proposals" ON public.proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own proposals" ON public.proposals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own proposals" ON public.proposals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own proposals" ON public.proposals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- tasks
DROP POLICY IF EXISTS "Users can create own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can create own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- timesheets
DROP POLICY IF EXISTS "Users can create own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users can view own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users can update own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users can delete own timesheets" ON public.timesheets;
CREATE POLICY "Users can create own timesheets" ON public.timesheets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own timesheets" ON public.timesheets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own timesheets" ON public.timesheets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own timesheets" ON public.timesheets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- currency_settings
DROP POLICY IF EXISTS "Users can create own currency settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Users can view own currency settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Users can update own currency settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Users can delete own currency settings" ON public.currency_settings;
CREATE POLICY "Users can create own currency settings" ON public.currency_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own currency settings" ON public.currency_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own currency settings" ON public.currency_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own currency settings" ON public.currency_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_backups
DROP POLICY IF EXISTS "Users can create their own backup" ON public.user_backups;
DROP POLICY IF EXISTS "Users can view their own backup" ON public.user_backups;
DROP POLICY IF EXISTS "Users can update their own backup" ON public.user_backups;
DROP POLICY IF EXISTS "Users can delete their own backup" ON public.user_backups;
CREATE POLICY "Users can create their own backup" ON public.user_backups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own backup" ON public.user_backups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own backup" ON public.user_backups FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own backup" ON public.user_backups FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== 20260306173332_b85d567f-06a8-4bd1-9901-b6f2b00d0fa1.sql =====

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


-- ===== 20260307132458_ee897409-f1c8-4e28-ae4b-fcbb5377d21f.sql =====

-- Create clients table
CREATE TABLE public.clients (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL,
  name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  tax_id text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own clients" ON public.clients FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create suppliers table
CREATE TABLE public.suppliers (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL,
  name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own suppliers" ON public.suppliers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create products table
CREATE TABLE public.products (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'product',
  sale_price numeric NOT NULL DEFAULT 0,
  raw_price numeric DEFAULT 0,
  stock_quantity numeric DEFAULT 0,
  low_stock_alert numeric DEFAULT 10,
  sku text,
  category text,
  components jsonb DEFAULT '[]'::jsonb,
  service_cost numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create invoices table
CREATE TABLE public.invoices (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  client_id text,
  client_name text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  tax numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  template text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoices" ON public.invoices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create estimates table
CREATE TABLE public.estimates (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  client_id text,
  client_name text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  expiry_date text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own estimates" ON public.estimates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  supplier_id text,
  supplier_name text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create receipts table
CREATE TABLE public.receipts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  client_id text,
  client_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  payment_date text,
  payment_method text DEFAULT '',
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  category text,
  vendor text,
  items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own receipts" ON public.receipts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===== 20260309065010_c469cfd7-2416-4b77-a1c1-3d344119ba2c.sql =====
-- Fix ALL restrictive policies to permissive

-- clients
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Users manage own clients" ON public.clients FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- suppliers
DROP POLICY IF EXISTS "Users manage own suppliers" ON public.suppliers;
CREATE POLICY "Users manage own suppliers" ON public.suppliers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- products
DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "Users manage own products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- invoices
DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices;
CREATE POLICY "Users manage own invoices" ON public.invoices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- estimates
DROP POLICY IF EXISTS "Users manage own estimates" ON public.estimates;
CREATE POLICY "Users manage own estimates" ON public.estimates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- purchase_orders
DROP POLICY IF EXISTS "Users manage own purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users manage own purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- receipts
DROP POLICY IF EXISTS "Users manage own receipts" ON public.receipts;
CREATE POLICY "Users manage own receipts" ON public.receipts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- proposals
DROP POLICY IF EXISTS "Select own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Insert own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Update own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Delete own proposals" ON public.proposals;
CREATE POLICY "Users manage own proposals" ON public.proposals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "Select own projects" ON public.projects;
DROP POLICY IF EXISTS "Insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Update own projects" ON public.projects;
DROP POLICY IF EXISTS "Delete own projects" ON public.projects;
CREATE POLICY "Users manage own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tasks
DROP POLICY IF EXISTS "Select own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Delete own tasks" ON public.tasks;
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- timesheets
DROP POLICY IF EXISTS "Select own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Insert own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Update own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Delete own timesheets" ON public.timesheets;
CREATE POLICY "Users manage own timesheets" ON public.timesheets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- currency_settings
DROP POLICY IF EXISTS "Select own currency_settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Insert own currency_settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Update own currency_settings" ON public.currency_settings;
DROP POLICY IF EXISTS "Delete own currency_settings" ON public.currency_settings;
CREATE POLICY "Users manage own currency_settings" ON public.currency_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_backups
DROP POLICY IF EXISTS "Select own backups" ON public.user_backups;
DROP POLICY IF EXISTS "Insert own backups" ON public.user_backups;
DROP POLICY IF EXISTS "Update own backups" ON public.user_backups;
DROP POLICY IF EXISTS "Delete own backups" ON public.user_backups;
CREATE POLICY "Users manage own backups" ON public.user_backups FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON public.estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON public.purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON public.proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_user_id ON public.timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_settings_user_id ON public.currency_settings(user_id);

-- Add updated_at triggers
CREATE OR REPLACE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== 20260401055901_88644713-b164-4283-bf6a-8737c5d42d08.sql =====

-- ============================================================
-- 1. CREATE NEW TABLES
-- ============================================================

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  address text,
  phone text,
  email text,
  tax_id text,
  currency text DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Organization Members (join table)
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  payment_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  expense_date timestamptz NOT NULL DEFAULT now(),
  payment_method text DEFAULT 'cash',
  status text DEFAULT 'paid',
  receipt_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Invoice Items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id text NOT NULL,
  product_id text,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  raw_cost numeric DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Estimate Items
CREATE TABLE public.estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  estimate_id text NOT NULL,
  product_id text,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  raw_cost numeric DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

-- Inventory Movements
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  movement_type text NOT NULL, -- sale, purchase, adjustment, manufacturing
  quantity numeric NOT NULL,
  reference_id text, -- invoice_id, po_id, etc.
  reference_type text, -- invoice, purchase_order, adjustment
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Activity Logs
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ADD organization_id TO EXISTING TABLES (nullable first)
-- ============================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 3. MIGRATE EXISTING DATA: create org per user, assign records
-- ============================================================

-- Create a default org for each distinct user_id in the system
INSERT INTO public.organizations (id, name)
SELECT DISTINCT gen_random_uuid(), 'My Organization'
FROM (
  SELECT DISTINCT user_id FROM public.clients
  UNION SELECT DISTINCT user_id FROM public.products
  UNION SELECT DISTINCT user_id FROM public.invoices
  UNION SELECT DISTINCT user_id FROM public.estimates
  UNION SELECT DISTINCT user_id FROM public.suppliers
  UNION SELECT DISTINCT user_id FROM public.purchase_orders
  UNION SELECT DISTINCT user_id FROM public.receipts
) all_users;

-- We need a function to do the data migration properly
CREATE OR REPLACE FUNCTION public.migrate_to_orgs() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec RECORD;
  org_id uuid;
BEGIN
  -- For each distinct user, create org + membership + update records
  FOR rec IN (
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM clients
      UNION SELECT user_id FROM products
      UNION SELECT user_id FROM invoices
      UNION SELECT user_id FROM estimates
      UNION SELECT user_id FROM suppliers
      UNION SELECT user_id FROM purchase_orders
      UNION SELECT user_id FROM receipts
    ) u
  ) LOOP
    -- Create org
    INSERT INTO organizations (name) VALUES ('My Organization') RETURNING id INTO org_id;
    -- Create membership
    INSERT INTO organization_members (organization_id, user_id, role) VALUES (org_id, rec.user_id, 'owner');
    -- Update all records for this user
    UPDATE clients SET organization_id = org_id WHERE user_id = rec.user_id;
    UPDATE products SET organization_id = org_id WHERE user_id = rec.user_id;
    UPDATE invoices SET organization_id = org_id WHERE user_id = rec.user_id;
    UPDATE estimates SET organization_id = org_id WHERE user_id = rec.user_id;
    UPDATE suppliers SET organization_id = org_id WHERE user_id = rec.user_id;
    UPDATE purchase_orders SET organization_id = org_id WHERE user_id = rec.user_id;
    UPDATE receipts SET organization_id = org_id WHERE user_id = rec.user_id;
  END LOOP;
END;
$$;

-- Run the migration
SELECT public.migrate_to_orgs();

-- Clean up: remove the duplicate orgs from the initial INSERT
DELETE FROM public.organizations WHERE id NOT IN (SELECT organization_id FROM public.organization_members);

-- Drop the migration function
DROP FUNCTION public.migrate_to_orgs();

-- ============================================================
-- 4. SECURITY DEFINER FUNCTION for org membership checks
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
$$;

-- ============================================================
-- 5. UPDATE RLS POLICIES - organization-based access
-- ============================================================

-- organizations: members can access their orgs
CREATE POLICY "Members can access own organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (id IN (SELECT public.user_org_ids()))
  WITH CHECK (true);

-- organization_members: users see their own memberships
CREATE POLICY "Users manage own memberships"
  ON public.organization_members FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Drop old user_id policies, add org-based policies for existing tables
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Org members manage clients"
  ON public.clients FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "Org members manage products"
  ON public.products FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices;
CREATE POLICY "Org members manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own estimates" ON public.estimates;
CREATE POLICY "Org members manage estimates"
  ON public.estimates FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own suppliers" ON public.suppliers;
CREATE POLICY "Org members manage suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own purchase_orders" ON public.purchase_orders;
CREATE POLICY "Org members manage purchase_orders"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Users manage own receipts" ON public.receipts;
CREATE POLICY "Org members manage receipts"
  ON public.receipts FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

-- New tables RLS policies
CREATE POLICY "Org members manage payments"
  ON public.payments FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members manage expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members manage invoice_items"
  ON public.invoice_items FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members manage estimate_items"
  ON public.estimate_items FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members manage inventory_movements"
  ON public.inventory_movements FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members manage activity_logs"
  ON public.activity_logs FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

-- ============================================================
-- 6. INDEXES for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_estimates_org_id ON public.estimates(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_org_id ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_id ON public.purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_receipts_org_id ON public.receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON public.payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_id ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_org_id ON public.invoice_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_org_id ON public.estimate_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_org_id ON public.inventory_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON public.activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON public.estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON public.inventory_movements(product_id);

-- updated_at triggers for new tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ===== 20260401055911_9af5f0dc-6125-458c-84a1-655115bfacb0.sql =====

DROP POLICY IF EXISTS "Members can access own organizations" ON public.organizations;
CREATE POLICY "Members can access own organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (id IN (SELECT public.user_org_ids()))
  WITH CHECK (id IN (SELECT public.user_org_ids()));


-- ===== 20260425204823_d6fd19e0-e98b-4ba6-aa00-35690fcd4e3f.sql =====
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS needs_sync boolean NOT NULL DEFAULT false;

-- ===== 20260425205354_c5563b98-43db-4df3-a638-30601a642611.sql =====
CREATE TABLE IF NOT EXISTS public.psa_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  invoice_id text,
  timesheet_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.psa_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage psa_audit_logs"
ON public.psa_audit_logs
FOR ALL
TO authenticated
USING (organization_id IN (SELECT public.user_org_ids()))
WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE INDEX IF NOT EXISTS idx_psa_audit_logs_org ON public.psa_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_psa_audit_logs_invoice ON public.psa_audit_logs(invoice_id);

-- ===== 20260426114821_59f17974-c5f6-4e77-9ecf-770016fb6829.sql =====
-- Helper to look up an auth user id by email for the invite (lookup-only) flow.
-- SECURITY DEFINER so RLS on auth.users (which is hidden) doesn't block us;
-- we only ever return the id, never the email or any other column.
CREATE OR REPLACE FUNCTION public.lookup_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;

-- Restrict execution: only signed-in users can call this.
REVOKE ALL ON FUNCTION public.lookup_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_user_id_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_user_id_by_email(text) TO authenticated;

-- ===== 20260428140435_19726031-5fb2-4e2d-a18a-d474ebc66dc5.sql =====
-- 1. Secure lookup_user_id_by_email RPC permissions
revoke all on function public.lookup_user_id_by_email(text) from public;
revoke all on function public.lookup_user_id_by_email(text) from anon;
grant execute on function public.lookup_user_id_by_email(text) to authenticated;

-- 2. Prevent duplicate members (DB level)
create unique index if not exists organization_members_org_user_uniq
  on public.organization_members (organization_id, user_id);

-- 3. Owner safety: prevent deleting last owner
create or replace function public.prevent_last_owner_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' then
    if (
      select count(*) from public.organization_members
      where organization_id = old.organization_id
        and role = 'owner'
    ) <= 1 then
      raise exception 'Cannot remove the last owner of an organization';
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_last_owner_delete_trigger on public.organization_members;
create trigger prevent_last_owner_delete_trigger
before delete on public.organization_members
for each row execute function public.prevent_last_owner_delete();

-- 3b. Same protection for role demotion (don't allow demoting the only owner)
create or replace function public.prevent_last_owner_demote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' and new.role <> 'owner' then
    if (
      select count(*) from public.organization_members
      where organization_id = old.organization_id
        and role = 'owner'
    ) <= 1 then
      raise exception 'Cannot demote the last owner of an organization';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_last_owner_demote_trigger on public.organization_members;
create trigger prevent_last_owner_demote_trigger
before update on public.organization_members
for each row execute function public.prevent_last_owner_demote();

-- 4. Role change RLS: only owners of the org can change roles, and only owners can promote to owner
-- Helper: is the current user an owner of this org?
create or replace function public.is_org_owner(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org_id
      and user_id = auth.uid()
      and role = 'owner'
  )
$$;

revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- Replace broad self-policy with narrower per-command policies
drop policy if exists "Users manage own memberships" on public.organization_members;

-- SELECT: members can see rows for orgs they belong to
create policy "Members view org memberships"
on public.organization_members
for select
to authenticated
using (organization_id in (select public.user_org_ids()));

-- INSERT: a user may insert their own first membership (org creation),
-- OR an owner of the org may add anyone
create policy "Owners or self can insert memberships"
on public.organization_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_org_owner(organization_id)
);

-- UPDATE: only owners of the org can change roles
create policy "Only owners can change roles"
on public.organization_members
for update
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

-- DELETE: owners can remove anyone; users can remove themselves
create policy "Owners or self can delete memberships"
on public.organization_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_owner(organization_id)
);

-- 5. Force organization_id NOT NULL on tenant tables (no nulls today)
alter table public.invoices       alter column organization_id set not null;
alter table public.estimates      alter column organization_id set not null;
alter table public.clients        alter column organization_id set not null;
alter table public.products       alter column organization_id set not null;
alter table public.suppliers      alter column organization_id set not null;
alter table public.receipts       alter column organization_id set not null;
alter table public.purchase_orders alter column organization_id set not null;

-- ===== 20260428141106_fe09dde1-d8d5-4274-9d7d-63c7de1b870c.sql =====
-- ============ 1. PLANS ============
alter table public.organizations
  add column if not exists plan text not null default 'free'
  check (plan in ('free','paid','pro'));

-- Seat limit lookup
create or replace function public.org_seat_limit(_plan text)
returns integer
language sql
immutable
as $$
  select case _plan
    when 'free' then 1
    when 'paid' then 5
    when 'pro'  then 10
    else 1
  end
$$;

-- Enforce seat limit on member insert
create or replace function public.enforce_org_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _plan text;
  _limit int;
  _count int;
begin
  select plan into _plan from public.organizations where id = new.organization_id;
  if _plan is null then return new; end if;
  _limit := public.org_seat_limit(_plan);
  select count(*) into _count from public.organization_members where organization_id = new.organization_id;
  if _count >= _limit then
    raise exception 'Plan limit reached: % allows % member(s).', _plan, _limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_org_seat_limit_trigger on public.organization_members;
create trigger enforce_org_seat_limit_trigger
before insert on public.organization_members
for each row execute function public.enforce_org_seat_limit();

-- ============ 2. EXPANDED ROLES ============
-- role is text (no enum), just widen the allowed set via check
alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner','admin','manager','agent','assistant','member'));

-- Permission helper
create or replace function public.has_permission(_action text, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with my as (
    select role from public.organization_members
    where user_id = auth.uid() and organization_id = _org_id
    limit 1
  )
  select case
    when (select role from my) is null then false
    when (select role from my) = 'owner' then true
    when _action = 'manage_billing' then (select role from my) = 'owner'
    when _action = 'delete_org' then (select role from my) = 'owner'
    when _action = 'manage_members' then (select role from my) in ('owner','admin')
    when _action = 'view_admin' then (select role from my) in ('owner','admin')
    when _action = 'manage_payment_methods' then (select role from my) in ('owner','admin')
    when _action = 'manage_invoices' then (select role from my) in ('owner','admin','manager')
    when _action = 'manage_projects' then (select role from my) in ('owner','admin','manager')
    when _action = 'write_timesheets' then (select role from my) in ('owner','admin','manager','agent')
    when _action = 'read' then true
    else false
  end
$$;

revoke all on function public.has_permission(text, uuid) from public;
grant execute on function public.has_permission(text, uuid) to authenticated;

-- ============ 3. PAYMENT METHODS ============
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  type text not null check (type in ('stripe','paypal','wish','omt','bank','card')),
  label text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_methods_org_idx on public.payment_methods(organization_id);

alter table public.payment_methods enable row level security;

-- All org members can SELECT (needed so invoice page can list active methods)
create policy "Org members read payment_methods"
on public.payment_methods
for select
to authenticated
using (organization_id in (select public.user_org_ids()));

-- Only owner/admin can write
create policy "Owner or admin insert payment_methods"
on public.payment_methods
for insert
to authenticated
with check (public.has_permission('manage_payment_methods', organization_id));

create policy "Owner or admin update payment_methods"
on public.payment_methods
for update
to authenticated
using (public.has_permission('manage_payment_methods', organization_id))
with check (public.has_permission('manage_payment_methods', organization_id));

create policy "Owner or admin delete payment_methods"
on public.payment_methods
for delete
to authenticated
using (public.has_permission('manage_payment_methods', organization_id));

create trigger payment_methods_set_updated_at
before update on public.payment_methods
for each row execute function public.update_updated_at_column();

-- ============ 4. INVOICES: payment_method column ============
alter table public.invoices
  add column if not exists payment_method text;

-- ===== 20260520100436_432b3844-a378-44a2-bdfe-d992328f21af.sql =====
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- ===== 20260522093859_10b91f3b-05ad-4a97-86c4-d27dce182cc0.sql =====

-- 1. Invoice payment hardening columns
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_verified_status
  ON public.invoices (payment_verified, status);

-- 2. Payment audit log table
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  invoice_id text,
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Org members can read their logs
CREATE POLICY "Org members read payment_audit_logs"
ON public.payment_audit_logs
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT user_org_ids()));

-- No client writes; only service role (webhooks) writes. (No INSERT policy = denied for authenticated)

CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_invoice
  ON public.payment_audit_logs (invoice_id, created_at DESC);


-- ===== 20260525133205_4357b41e-262c-44ec-9c00-882df7f28afe.sql =====

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


-- ===== 20260525142345_40ed92f2-c42f-4da8-813e-05a880135560.sql =====

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


-- ===== 20260525152639_4acc234d-48bc-44d0-b945-0968fc17bb3f.sql =====

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


-- ===== 20260525153609_20984c02-6b0c-4a5f-9665-754d1f7d8222.sql =====
-- Prevent client-side plan upgrades. Only service_role (webhooks/edge functions) can change plan.
CREATE OR REPLACE FUNCTION public.prevent_client_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Plan changes must be processed through verified payment. Contact support to upgrade.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_prevent_plan_change ON public.organizations;
CREATE TRIGGER organizations_prevent_plan_change
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_plan_change();

-- ===== 20260525155324_209c2881-03ed-49ba-87a9-fea10683edff.sql =====
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

-- ===== 20260525165031_9f4c9cc6-f71f-43fd-aafc-645b87ed1a74.sql =====

-- 1) Prevent client from reading the encrypted config column (contains Stripe secret keys).
-- Edge functions use the service_role key and bypass column grants.
REVOKE SELECT (config) ON public.payment_methods FROM authenticated, anon;

-- 2) Lock down email enumeration RPC to org owners/admins only.
CREATE OR REPLACE FUNCTION public.lookup_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND role IN ('owner','admin')
  ) INTO _allowed;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN (SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1);
END;
$$;


-- ===== 20260604183550_40b73862-1ca0-4dce-bae4-643b1e69b849.sql =====
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

-- ===== 20260608210508_5a8067d2-4d4c-47f1-959b-345a5b5b4b80.sql =====

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


-- ===== 20260608210919_584e571e-79e5-4bb7-9791-9d08fc80ef6e.sql =====

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


-- ===== 20260611180945_68c90ef4-531f-43ff-a7f3-5e3a34045ff2.sql =====
-- Atomic, security-definer organization bootstrap.
-- Fixes: client-side INSERT ... RETURNING on organizations fails with 42501
-- because the org SELECT policy (id IN user_org_ids()) cannot see the new row
-- before the owner membership exists (chicken-and-egg).
CREATE OR REPLACE FUNCTION public.bootstrap_organization(_name text DEFAULT 'My Organization')
RETURNS TABLE (
  id uuid, name text, plan text, logo_url text, address text,
  phone text, email text, tax_id text, currency text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    _name := 'My Organization';
  END IF;

  -- Create the organization
  INSERT INTO public.organizations (name, plan)
  VALUES (trim(_name), 'free')
  RETURNING organizations.id INTO _org_id;

  -- Create the owner membership atomically
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, _uid, 'owner');

  RETURN QUERY
    SELECT o.id, o.name, o.plan, o.logo_url, o.address, o.phone, o.email, o.tax_id, o.currency
    FROM public.organizations o
    WHERE o.id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_organization(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_organization(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_organization(text) TO service_role;

-- ===== 20260612141744_e0147c25-cc20-4f2d-8120-70542419b8c6.sql =====
UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'audit-flow@aynbeirut.com' AND email_confirmed_at IS NULL;
