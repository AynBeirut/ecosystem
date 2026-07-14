
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
