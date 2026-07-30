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