
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
// exportDocumentAsPdf is now invoked through documentLogic.generatePDF
import { onAuthStateChanged, signOut as firebaseSignOut, getRedirectResult } from "firebase/auth";
import { getFinanceAuth, getFinanceAuthReady } from "@/integrations/firebase/client";
import { supabase } from "@/integrations/supabase/client";
import { resolveGrabioStore, storeProfileToCompany, updateFinanceDocumentSettings, type StoreCompanyView } from "@/lib/grabio/storeService";
import type { FinanceDocumentSettings } from "@/lib/grabio/types";
import { resolveInvoiceAppPlan } from "@/lib/grabio/entitlements";
import {
  mapDbClient, mapDbSupplier, mapDbProduct, mapDbInvoice,
  mapDbEstimate, mapDbPurchaseOrder, mapDbReceipt, mapDbPayment, mapDbExpense,
} from "./helpers/dbMappers";
import { dbInsert, dbUpdate, dbDelete, dbBulkInsert, dbDeleteWhere, flushPendingOps } from "./helpers/dbOps";
import { setFinanceStoreId } from "@/lib/firestore/storeContext";

const contextLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};
import { loadStoreData } from "@/lib/firestore/loadStoreData";
import { migrateLocalPaymentOrders } from "@/lib/firestore/migratePaymentOrders";
import {
  calculateComposedProductCost as calcComposedCost,
  insertInventoryMovement as insertInvMovement,
  updateInventoryForComposedProduct,
  recordStockMovement,
} from "./helpers/inventoryLogic";
import { generatePDF, generatePdfFile, sendDocumentEmail, type DocumentType } from "./helpers/documentLogic";
import { resolveClientId, resolveSupplierId, syncLineItemsToCatalog } from "./helpers/catalogSync";
import { toast } from "sonner";
import {
  glPostPurchasePayment,
  glSyncInvoiceGl,
  glSyncPurchasesOnLoad,
} from "@/lib/ledger/glBridge";
import type { SimImportRunSummary, SimMigrationData } from "@/lib/simImport";

/** Phase A1 removes this flag — all data reads/writes go through Firestore. */
const USE_SUPABASE_LEGACY = import.meta.env.VITE_USE_SUPABASE_LEGACY === "true";

const guardOrg = (orgId: string | null, userId: string | null): boolean => {
  if (!userId) { toast.error("Please sign in first."); return false; }
  if (!orgId) { toast.error("No active organization selected."); return false; }
  return true;
};

// ============ Types ============

type Company = {
  name: string; address: string; phone: string; logo: string;
  email?: string; website?: string; signature?: string;
  primaryColor?: string; secondaryColor?: string;
  invoiceTemplate?: "basic" | "modern" | "professional";
  taxId?: string; commercialRegistry?: string; description?: string;
};

export interface User {
  email: string;
  plan: "free" | "pro";
  isDemoAccount?: boolean;
  company: Company;
  isDarkMode?: boolean;
  createdCounts: {
    invoices: { [key: string]: number };
    estimates: { [key: string]: number };
    receipts: { [key: string]: number };
    purchaseOrders: { [key: string]: number };
  };
  subUsers?: Array<{ id: string; email: string; name: string; role: "Editor" | "Co-Admin" }>;
}

export interface Product {
  id: string; name: string; description?: string;
  type: "product" | "service" | "composed";
  salePrice: number; rawPrice?: number; stockQuantity?: number;
  lowStockAlert?: number; sku?: string; category?: string;
  components?: ComposedProductComponent[]; serviceCost?: number;
}

export interface ComposedProductComponent {
  productId: string; productName: string; quantity: number; unitCost: number;
}

export interface Client {
  id: string; name: string; address: string; phone: string; email: string; taxId?: string;
}

export interface Supplier {
  id: string; name: string; address: string; phone: string; email: string;
}

export interface LineItem {
  id: string; description: string; quantity: number; unitPrice: number;
  rawPrice?: number; subtotal: number;
}

export interface Receipt {
  id: string; date: string; clientName: string; clientId?: string;
  amount: number; paymentDate: string; paymentMethod: string; currency: string;
  notes?: string; category?: string; vendor?: string;
  items?: Array<{ description: string; quantity: number; unitPrice: number; rawPrice?: number }>;
}

export interface Invoice {
  id: string; date: string; clientId?: string; clientName: string;
  items: LineItem[]; amount: number; currency: string;
  status: "draft" | "sent" | "partial" | "paid" | "pending_manual_payment";
  tax?: number; discount?: number;
  total?: number; template?: string; notes?: string;
  paymentMethod?: string;
  paidAmount?: number;
  paidAt?: string;
}

export interface Estimate {
  id: string; date: string; clientId?: string; clientName: string;
  items: LineItem[]; amount: number; currency: string;
  status: "pending" | "approved" | "rejected"; expiryDate?: string; notes?: string;
}

export interface PurchaseOrder {
  id: string; date: string; supplierId?: string; supplierName: string;
  items: LineItem[]; amount: number; currency: string;
  status: "draft" | "sent" | "approved" | "fulfilled"; notes?: string;
  /** Platform `purchases` payment state (unpaid / partial / paid). */
  paymentStatus?: "unpaid" | "partial" | "paid" | string;
  total?: number;
  paidAmount?: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  taxType?: string;
  totalCost?: number;
  /** Where the PO row came from for AP aging rules. */
  source?: "platform" | "finance";
}

export interface PaymentOrder {
  id: string; date: string; supplierId?: string; supplierName: string;
  amount: number; currency: string; status: "draft" | "sent" | "paid";
  paymentMethod?: string; notes?: string;
  purchaseOrderId?: string;
}

export interface Payment {
  id: string; invoiceId: string; amount: number; paymentMethod: string;
  paymentDate: string; notes?: string;
}

export interface Expense {
  id: string; name: string; description?: string; category: string;
  amount: number; expenseDate: string; paymentMethod: string;
  status: string; receiptUrl?: string; notes?: string;
}

export interface Organization {
  id: string; name: string; logoUrl?: string; address?: string;
  phone?: string; email?: string; website?: string; taxId?: string; currency?: string;
  plan?: 'free' | 'paid' | 'pro';
}

type PortfolioItem = { id: string; image: string; caption: string; description?: string };

interface AppContextType {
  user: User | null;
  invoices: Invoice[];
  receipts: Receipt[];
  estimates: Estimate[];
  clients: Client[];
  suppliers: Supplier[];
  products: Product[];
  portfolioItems: PortfolioItem[];
  paymentOrders: PaymentOrder[];
  purchaseOrders: PurchaseOrder[];
  payments: Payment[];
  expenses: Expense[];
  isLoggedIn: boolean;
  isDarkMode: boolean;
  activeOrganizationId: string | null;
  organizations: Organization[];
  setActiveOrganizationId: (id: string) => void;
  currentUserRole: 'owner' | 'admin' | 'manager' | 'agent' | 'assistant' | 'member' | null;
  hasPermission: (action: string) => boolean;
  inviteUserToOrg: (email: string, role: 'admin' | 'manager' | 'agent' | 'assistant') => Promise<{ ok: boolean; message: string }>;
  listOrgMembers: () => Promise<Array<{ user_id: string; role: string; email?: string }>>;
  removeOrgMember: (userId: string) => Promise<boolean>;
  updateMemberRole: (userId: string, role: 'admin' | 'manager' | 'agent' | 'assistant') => Promise<boolean>;
  updateOrgPlan: (plan: 'free' | 'paid' | 'pro') => Promise<boolean>;
  financialSummary: { totalIncome: number; totalExpenses: number; balance: number };
  accountingSummary: {
    totalRevenue: number; cogs: number; grossProfit: number;
    totalExpenses: number; netProfit: number; outstandingAmount: number;
    lowStockProducts: Product[];
  };
  login: (email: string, password: string) => boolean;
  logout: () => void;
  createInvoice: (invoice: Omit<Invoice, "id" | "date" | "status">) => Promise<string | null>;
  createEstimate: (estimate: Omit<Estimate, "id" | "date" | "status">) => Promise<string | null>;
  convertEstimateToInvoice: (estimateId: string) => Promise<boolean>;
  createReceipt: (receipt: Omit<Receipt, "id" | "date">) => Promise<string | null>;
  createPaymentOrder: (po: Omit<PaymentOrder, "id" | "date" | "status">) => string | null;
  createPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "date" | "status">) => Promise<string | null>;
  updateCompanyProfile: (companyData: Partial<Company>) => void;
  addClient: (client: Omit<Client, "id">) => Promise<string | null>;
  addSupplier: (supplier: Omit<Supplier, "id">) => Promise<string | null>;
  addProduct: (product: Omit<Product, "id">) => Promise<string | null>;
  updateProduct: (productId: string, data: Partial<Product>) => void;
  deleteProduct: (productId: string) => void;
  deleteClient: (clientId: string) => void;
  updateClient: (clientId: string, data: Partial<Client>) => void;
  deleteSupplier: (supplierId: string) => void;
  updateSupplier: (supplierId: string, data: Partial<Supplier>) => void;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  updateInvoice: (invoiceId: string, data: Partial<Invoice>) => void;
  recordInvoicePayment: (invoiceId: string, amount: number, paymentMethod?: string) => void;
  deleteEstimate: (estimateId: string) => void;
  updateEstimate: (estimateId: string, data: Partial<Estimate>) => void;
  deletePurchaseOrder: (poId: string) => Promise<void>;
  updatePurchaseOrder: (poId: string, data: Partial<PurchaseOrder>) => void;
  updatePaymentOrder: (poId: string, data: Partial<PaymentOrder>) => void;
  markPaymentOrderPaid: (poId: string, paymentMethod?: string) => void;
  deleteReceipt: (receiptId: string) => void;
  updateReceipt: (receiptId: string, data: Partial<Receipt>) => void;
  addPortfolioItem: (item: Omit<PortfolioItem, "id">) => void;
  manufactureProduct: (composedProductId: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
  upgradeAccount: () => void;
  setDemoMode: (enabled: boolean) => void;
  toggleDeveloperProMode: () => void;
  toggleDarkMode: () => void;
  updatePassword: (currentPassword: string, newPassword: string) => boolean;
  updateEmail: (email: string, password: string) => boolean;
  addSubUser: (email: string, role: "Editor" | "Co-Admin") => void;
  previewInvoice: (invoiceId: string) => Invoice | null;
  previewEstimate: (estimateId: string) => Estimate | null;
  previewReceipt: (receiptId: string) => Receipt | null;
  previewPaymentOrder: (paymentOrderId: string) => PaymentOrder | null;
  previewPurchaseOrder: (purchaseOrderId: string) => PurchaseOrder | null;
  sendInvoice: (invoiceId: string, recipientEmail: string) => Promise<boolean>;
  sendEstimate: (estimateId: string, recipientEmail: string) => Promise<boolean>;
  sendReceipt: (receiptId: string, recipientEmail: string) => Promise<boolean>;
  sendPaymentOrder: (paymentOrderId: string, recipientEmail: string) => Promise<boolean>;
  sendPurchaseOrder: (purchaseOrderId: string, recipientEmail: string) => Promise<boolean>;
  exportInvoiceAsPdf: (invoiceId: string) => Promise<boolean>;
  exportEstimateAsPdf: (estimateId: string) => Promise<boolean>;
  exportReceiptAsPdf: (receiptId: string) => Promise<boolean>;
  exportPaymentOrderAsPdf: (paymentOrderId: string) => Promise<boolean>;
  exportPurchaseOrderAsPdf: (purchaseOrderId: string) => Promise<boolean>;
  getDocumentPdfFile: (documentType: string, documentId: string) => Promise<File | null>;
  updateSettings: (settings: any) => void;
  reloadStoreProfile: () => Promise<void>;
  refreshDocumentCompany: () => Promise<StoreCompanyView | null>;
  checkLimit: (type: "invoices" | "estimates" | "receipts" | "purchaseOrders" | "clients" | "products") => { allowed: boolean; current: number; limit: number; message?: string };
  getCurrentMonthKey: () => string;
  calculateComposedProductCost: (product: Product) => number;
  generateInvoiceDraftFromProject: (projectId: string) => Promise<InvoiceDraftFromProject | null>;
  retryFailedTimesheets: () => Promise<void>;
  importSimMigration: (migration: SimMigrationData) => Promise<SimImportRunSummary>;
}

export interface InvoiceDraftFromProject {
  clientId?: string;
  clientName: string;
  items: LineItem[];
  amount: number;
  currency: string;
  _timesheetIds: string[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const FREE_TIER_LIMITS = { documents: 10, clients: 10, products: 10 };

// ============ Helper: inventory movement insert (org-scoped wrapper) ============
const insertInventoryMovement = async (
  orgId: string, productId: string, type: string,
  quantity: number, referenceId: string, referenceType: string,
) => {
  await insertInvMovement({
    orgId, productId,
    type: type as any,
    quantity, referenceId, referenceType,
  });
};

// ============ Provider ============

export const AppProvider: React.FC<{ children: React.ReactNode; embedded?: boolean }> = ({ children, embedded = false }) => {
  const [authReady, setAuthReady] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const userEmailRef = useRef<string | null>(null);

  // Organization state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrgId] = useState<string | null>(() =>
    embedded ? null : localStorage.getItem('activeOrganizationId'),
  );
  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'admin' | 'manager' | 'agent' | 'assistant' | 'member' | null>(null);
  const orgIdRef = useRef<string | null>(activeOrganizationId);

  const setActiveOrganizationId = useCallback(async (id: string) => {
    setActiveOrgId(id);
    orgIdRef.current = id;
    localStorage.setItem('activeOrganizationId', id);
    // Refresh current user's role for the newly selected org (legacy Supabase only)
    if (USE_SUPABASE_LEGACY && userIdRef.current) {
      const { data } = await supabase
        .from('organization_members' as any)
        .select('role')
        .eq('user_id', userIdRef.current)
        .eq('organization_id', id)
        .maybeSingle();
      setCurrentUserRole(((data as any)?.role as any) || 'member');
    }
  }, []);

  // ===== Org membership management (lookup-only invites) =====
  const inviteUserToOrg = useCallback(async (email: string, role: 'admin' | 'manager' | 'agent' | 'assistant') => {
    if (!USE_SUPABASE_LEGACY) {
      return { ok: false, message: 'Organization invites are managed in Grabio Admin.' };
    }
    const orgId = orgIdRef.current;
    if (!orgId) return { ok: false, message: 'No active organization' };
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
      return { ok: false, message: 'Only owners and admins can invite' };
    }

    const { data: lookup, error: lookupErr } = await supabase
      .rpc('lookup_user_id_by_email' as any, { _email: email.trim().toLowerCase() });

    if (lookupErr || !lookup) {
      return { ok: false, message: 'No registered user found with that email. Ask them to sign up first.' };
    }

    const { error: insErr } = await supabase
      .from('organization_members' as any)
      .insert({ user_id: lookup, organization_id: orgId, role });

    if (insErr) {
      if (insErr.code === '23505') return { ok: false, message: 'User is already a member of this organization' };
      // Plan limit raised by trigger
      if ((insErr as any).message?.toLowerCase().includes('plan limit')) {
        return { ok: false, message: (insErr as any).message };
      }
      return { ok: false, message: insErr.message };
    }
    return { ok: true, message: 'Member added' };
  }, [currentUserRole]);

  const listOrgMembers = useCallback(async () => {
    const orgId = orgIdRef.current;
    if (!orgId) return [];
    const { data, error } = await supabase
      .from('organization_members' as any)
      .select('user_id, role')
      .eq('organization_id', orgId);
    if (error) { console.error('[listOrgMembers]', error); return []; }
    return ((data as any[]) || []) as Array<{ user_id: string; role: string }>;
  }, []);

  const removeOrgMember = useCallback(async (userId: string) => {
    const orgId = orgIdRef.current;
    if (!orgId) return false;
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') return false;
    const { error } = await supabase
      .from('organization_members' as any)
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId);
    if (error) { console.error('[removeOrgMember]', error); return false; }
    return true;
  }, [currentUserRole]);

  const updateMemberRole = useCallback(async (userId: string, role: 'admin' | 'manager' | 'agent' | 'assistant') => {
    const orgId = orgIdRef.current;
    if (!orgId) return false;
    if (currentUserRole !== 'owner') return false; // RLS also enforces this
    const { error } = await supabase
      .from('organization_members' as any)
      .update({ role })
      .eq('organization_id', orgId)
      .eq('user_id', userId);
    if (error) { console.error('[updateMemberRole]', error); return false; }
    return true;
  }, [currentUserRole]);

  const updateOrgPlan = useCallback(async (_plan: 'free' | 'paid' | 'pro') => {
    // Plan changes are server-enforced via verified payment webhooks only.
    // Client-side updates are rejected by the `prevent_client_plan_change` DB trigger.
    console.warn('[updateOrgPlan] Disabled: plan upgrades require verified payment.');
    return false;
  }, []);

  // Pure client-side mirror of public.has_permission for UI gating.
  // Server-side RLS + triggers remain the source of truth.
  const hasPermission = useCallback((action: string): boolean => {
    const r = currentUserRole;
    if (!r) return false;
    if (r === 'owner') return true;
    switch (action) {
      case 'manage_billing':
      case 'delete_org':
        return false; // owner already returned true above
      case 'manage_members':
      case 'view_admin':
      case 'manage_payment_methods':
        return r === 'admin';
      case 'manage_invoices':
      case 'manage_projects':
        return r === 'admin' || r === 'manager';
      case 'write_timesheets':
        return r === 'admin' || r === 'manager' || r === 'agent';
      case 'read':
        return true;
      default:
        return false;
    }
  }, [currentUserRole]);

  // Entity state
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // localStorage-only state
  const storedPortfolioItems = localStorage.getItem("portfolioItems");
  const storedDarkMode = localStorage.getItem("darkMode");
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>(storedPortfolioItems ? JSON.parse(storedPortfolioItems) : []);
  const [isDarkMode, setIsDarkMode] = useState(storedDarkMode === "true");

  // ===== Load Grabio store (replaces Supabase organizations) =====
  const loadOrganizations = useCallback(async (): Promise<string | null> => {
    const uid = userIdRef.current;
    const email = userEmailRef.current;
    if (!uid || !email) return null;

    try {
      const { storeId, profile, role } = await resolveGrabioStore(uid, email);
      const company = storeProfileToCompany(profile);
      const plan = resolveInvoiceAppPlan(profile, email);
      const mapped: Organization[] = [{
        id: storeId,
        name: profile.name || profile.storeName || company.name || 'My Organization',
        logoUrl: profile.logo,
        address: company.address,
        phone: company.phone,
        email: company.email || email,
        website: company.website,
        taxId: profile.taxId,
        currency: 'USD',
        plan,
      }];
      setOrganizations(mapped);
      setActiveOrgId(storeId);
      orgIdRef.current = storeId;
      localStorage.setItem('activeOrganizationId', storeId);
      setCurrentUserRole(role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'member');
      setUser(prev => prev ? { ...prev, plan, company: { ...company } } : prev);
      setFinanceStoreId(storeId);
      return storeId;
    } catch (err) {
      console.error("[Context][GrabioStore][load]", err);
      return null;
    }
  }, []);

  // ===== Load all org-scoped data =====
  const loadAllData = useCallback(async (orgId: string) => {
    contextLog("[Context] Loading data for store:", orgId);
    if (USE_SUPABASE_LEGACY) {
      const q = (table: string) => supabase.from(table as any).select('*').eq('organization_id', orgId);

      const [cR, sR, pR, iR, eR, poR, rR, payR, expR] = await Promise.all([
        q('clients'), q('suppliers'), q('products'), q('invoices'),
        q('estimates'), q('purchase_orders'), q('receipts'),
        q('payments'), q('expenses'),
      ]);

      if (cR.data) setClients((cR.data as any[]).map(mapDbClient));
      if (sR.data) setSuppliers((sR.data as any[]).map(mapDbSupplier));
      if (pR.data) setProducts((pR.data as any[]).map(mapDbProduct));
      if (iR.data) setInvoices((iR.data as any[]).map(mapDbInvoice));
      if (eR.data) setEstimates((eR.data as any[]).map(mapDbEstimate));
      if (poR.data) setPurchaseOrders((poR.data as any[]).map(mapDbPurchaseOrder));
      if (rR.data) setReceipts((rR.data as any[]).map(mapDbReceipt));
      if (payR.data) setPayments((payR.data as any[]).map(mapDbPayment));
      if (expR.data) setExpenses((expR.data as any[]).map(mapDbExpense));
      contextLog("[Context] Supabase data loaded.");
      return;
    }

    try {
      setFinanceStoreId(orgId);
      const data = await loadStoreData(orgId);
      const paymentOrdersLoaded = await migrateLocalPaymentOrders(orgId, data.paymentOrders);
      setClients(data.clients);
      setSuppliers(data.suppliers);
      setProducts(data.products);
      setInvoices(data.invoices);
      setEstimates(data.estimates);
      setPurchaseOrders(data.purchaseOrders);
      setPaymentOrders(paymentOrdersLoaded);
      setReceipts(data.receipts);
      setPayments(data.payments);
      setExpenses(data.expenses);
      void glSyncPurchasesOnLoad(orgId, data.purchaseOrders);
      contextLog("[Context] Firestore data loaded.");
    } catch (err) {
      console.error("[Context][Firestore][load]", err);
      toast.error("Failed to load your finance data. Please refresh.");
    }
  }, []);

  // Build User session shell — company comes from storeProfiles via loadOrganizations only.
  const buildUserFromSession = (email: string, plan: User['plan'] = 'free'): User => {
    let createdCounts: User['createdCounts'] = {
      invoices: {}, estimates: {}, receipts: {}, purchaseOrders: {},
    };
    let isDemoAccount: boolean | undefined;

    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<User>;
        if (parsed.email === email) {
          if (parsed.createdCounts) createdCounts = parsed.createdCounts;
          isDemoAccount = parsed.isDemoAccount;
        }
      } catch { /* ignore corrupt cache */ }
    }

    return {
      email,
      plan,
      isDemoAccount,
      createdCounts,
      company: {
        name: '',
        address: '',
        phone: '',
        email: '',
        logo: '',
        primaryColor: '#38B2AC',
        secondaryColor: '#C7D2FE',
        invoiceTemplate: 'basic',
      },
    };
  };

  // ===== Auth initialization (Firebase / Grabio) =====
  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;

    const clearSession = () => {
      userIdRef.current = null;
      userEmailRef.current = null;
      orgIdRef.current = null;
      setFinanceStoreId(null);
      setActiveOrgId(null);
      localStorage.removeItem('activeOrganizationId');
      setUser(null);
      setIsLoggedIn(false);
      setOrganizations([]);
      setClients([]);
      setSuppliers([]);
      setProducts([]);
      setInvoices([]);
      setEstimates([]);
      setPurchaseOrders([]);
      setPaymentOrders([]);
      setReceipts([]);
      setPayments([]);
      setExpenses([]);
    };

    const initSession = async (userId: string, email: string) => {
      userIdRef.current = userId;
      userEmailRef.current = email;
      setUser(buildUserFromSession(email));
      setIsLoggedIn(true);
      const orgId = await loadOrganizations();
        if (orgId) {
        await loadAllData(orgId);
        flushPendingOps();
      }
    };

    const boot = async () => {
      await getFinanceAuthReady();
      if (!mounted) return;

      try {
        await getRedirectResult(getFinanceAuth());
      } catch (err) {
        console.error("[Context][Auth] redirect result failed", err);
      }

      unsub = onAuthStateChanged(getFinanceAuth(), async (firebaseUser) => {
        if (!mounted) return;
        contextLog("[Context][Auth]", firebaseUser?.uid ?? "signed-out");
        if (firebaseUser?.email) {
          await initSession(firebaseUser.uid, firebaseUser.email);
        } else {
          clearSession();
        }
        if (mounted) setAuthReady(true);
      });
    };

    void boot();
    return () => {
      mounted = false;
      unsub?.();
    };
  }, [loadAllData, loadOrganizations]);

  const reloadStoreProfile = useCallback(async () => {
    const orgId = await loadOrganizations();
    if (orgId) await loadAllData(orgId);
  }, [loadAllData, loadOrganizations]);

  /** Always pull latest store identity from Firestore server before PDFs / send. */
  const refreshDocumentCompany = useCallback(async (): Promise<StoreCompanyView | null> => {
    const uid = userIdRef.current;
    const email = userEmailRef.current || '';
    if (!uid) return null;
    try {
      const { storeId, profile, role } = await resolveGrabioStore(uid, email);
      const company = storeProfileToCompany(profile);
      const plan = resolveInvoiceAppPlan(profile, email);
      const mapped: Organization[] = [{
        id: storeId,
        name: profile.name || profile.storeName || company.name || 'My Organization',
        logoUrl: profile.logo,
        address: company.address,
        phone: company.phone,
        email: company.email || email,
        website: company.website,
        taxId: profile.taxId,
        currency: 'USD',
        plan,
      }];
      setOrganizations(mapped);
      setActiveOrgId(storeId);
      orgIdRef.current = storeId;
      localStorage.setItem('activeOrganizationId', storeId);
      setCurrentUserRole(role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'member');
      setUser((prev) => (prev ? { ...prev, plan, company: { ...company } } : prev));
      setFinanceStoreId(storeId);
      return company;
    } catch (err) {
      console.error('[Context][CompanyRefresh]', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const onProfileUpdated = () => {
      void reloadStoreProfile();
    };
    window.addEventListener('grabio:store-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('grabio:store-profile-updated', onProfileUpdated);
  }, [reloadStoreProfile]);

  // Reload data when active org changes
  useEffect(() => {
    if (activeOrganizationId && isLoggedIn) {
      loadAllData(activeOrganizationId);
    }
  }, [activeOrganizationId]);

  // ===== Computed summaries =====
  const financialSummary = React.useMemo(() => {
    const totalIncome = receipts.filter(r => !r.category).reduce((s, r) => s + r.amount, 0);
    const totalExpenses = receipts.filter(r => r.category).reduce((s, r) => s + r.amount, 0)
      + expenses.reduce((s, e) => s + e.amount, 0);
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
  }, [receipts, expenses]);

  const accountingSummary = React.useMemo(() => {
    const paidInvoices = invoices.filter(inv => inv.status === "paid");
    const totalRevenue = paidInvoices.reduce((s, inv) => s + inv.amount, 0);
    let cogs = 0;
    paidInvoices.forEach(inv => inv.items?.forEach(item => {
      // Forward-only accounting: use stored unit-cost snapshot from invoice line.
      cogs += (item.rawPrice || 0) * item.quantity;
    }));
    const grossProfit = totalRevenue - cogs;
    const receiptExp = receipts.filter(r => r.category).reduce((s, r) => s + r.amount, 0);
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const totalExpenses = receiptExp + expenseTotal;
    const netProfit = grossProfit - totalExpenses;
    const outstandingAmount = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
    const lowStockProducts = products.filter(
      p => (p.type === "product" || p.type === "composed") && p.stockQuantity !== undefined && p.stockQuantity < (p.lowStockAlert || 10)
    );
    return { totalRevenue, cogs, grossProfit, totalExpenses, netProfit, outstandingAmount, lowStockProducts };
  }, [invoices, receipts, products, expenses]);

  const calculateComposedProductCostFn = (product: Product): number => {
    return calcComposedCost(product, 1);
  };

  const snapshotInvoiceUnitCost = (item: LineItem): number => {
    const prod = products.find(p => p.id === item.id);
    if (!prod) return item.rawPrice ?? 0;
    // Snapshot once at save time from current platform-synced product cost.
    return item.rawPrice ?? prod.rawPrice ?? prod.serviceCost ?? 0;
  };

  // Persist usage counters only — never cache company profile in localStorage.
  useEffect(() => {
    if (!user) {
      localStorage.removeItem("user");
      return;
    }
    localStorage.setItem("user", JSON.stringify({
      email: user.email,
      plan: user.plan,
      createdCounts: user.createdCounts,
      isDemoAccount: user.isDemoAccount,
    }));
  }, [user?.email, user?.plan, user?.createdCounts, user?.isDemoAccount]);
  useEffect(() => { localStorage.setItem("portfolioItems", JSON.stringify(portfolioItems)); }, [portfolioItems]);
  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode.toString());
    isDarkMode ? document.documentElement.classList.add("dark") : document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  // ===== Limits =====
  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const checkLimit = (type: "invoices" | "estimates" | "receipts" | "purchaseOrders" | "clients" | "products") => {
    if (!user) return { allowed: false, current: 0, limit: 0, message: "Please log in to continue" };
    if (user.plan === "pro" || user.isDemoAccount) return { allowed: true, current: 0, limit: Infinity };
    if (type === "clients") {
      const c = clients.length; const l = FREE_TIER_LIMITS.clients;
      return { allowed: c < l, current: c, limit: l, message: c >= l ? `Limit reached: ${c}/${l} clients.` : undefined };
    }
    if (type === "products") {
      const c = products.length; const l = FREE_TIER_LIMITS.products;
      return { allowed: c < l, current: c, limit: l, message: c >= l ? `Limit reached: ${c}/${l} products.` : undefined };
    }
    const mk = getCurrentMonthKey();
    const c = user.createdCounts[type]?.[mk] || 0;
    const l = FREE_TIER_LIMITS.documents;
    return { allowed: c < l, current: c, limit: l, message: c >= l ? `Monthly limit reached: ${c}/${l} ${type}.` : undefined };
  };

  const incrementDocumentCount = (type: "invoices" | "estimates" | "receipts" | "purchaseOrders") => {
    if (!user) return;
    const mk = getCurrentMonthKey();
    setUser(prev => prev ? {
      ...prev,
      createdCounts: { ...prev.createdCounts, [type]: { ...prev.createdCounts[type], [mk]: (prev.createdCounts[type][mk] || 0) + 1 } }
    } : prev);
  };

  // ===== Getters =====
  const getOrgId = (): string | null => orgIdRef.current;
  const getUserId = (): string | null => userIdRef.current;

  // ===== CRUD: Invoices =====

  // Local apply: signed delta to a single product's stockQuantity
  const applyLocalStockUpdate = (productId: string, delta: number) => {
    setProducts(prev => prev.map(p =>
      p.id === productId && p.stockQuantity !== undefined
        ? { ...p, stockQuantity: p.stockQuantity + delta }
        : p
    ));
  };

  const createInvoice = async (invoice: Omit<Invoice, "id" | "date" | "status">): Promise<string | null> => {
    const userId = getUserId(); const orgId = getOrgId();
    if (!guardOrg(orgId, userId)) return null;
    const limitCheck = checkLimit("invoices");
    if (!limitCheck.allowed) { toast.error(limitCheck.message || "Monthly invoice limit reached."); return null; }

    const resolvedClientId = await resolveClientId(clients, addClient, invoice.clientId, invoice.clientName);
    const syncedItems = await syncLineItemsToCatalog(products, addProduct, invoice.items);
    const invoicePayload = {
      ...invoice,
      clientId: resolvedClientId,
      items: syncedItems,
    };

    // STRICT stock validation — abort if ANY item fails
    for (const item of invoicePayload.items) {
      const prod = products.find(p => p.id === item.id);
      if (!prod) continue;
      if (prod.type === "service") continue;
      // For both "product" and "composed", check ONLY composed/product stock (not components)
      if (prod.stockQuantity === undefined) continue;
      if (prod.stockQuantity < item.quantity) {
        console.error(`[Context][Invoice][create] Insufficient stock for ${prod.name}`);
        return null;
      }
    }

    const id = `INV-${Date.now()}`;
    const date = new Date().toISOString();

    // Snapshot unit cost once at invoice save time (forward-only COGS).
    const normalizedItems: LineItem[] = invoicePayload.items.map(item => {
      const unitCost = snapshotInvoiceUnitCost(item);
      return { ...item, rawPrice: unitCost };
    });

    const newInvoice: Invoice = { ...invoicePayload, items: normalizedItems, id, date, status: "draft" };

    // Apply stock deductions via helpers ONLY (no direct dbUpdate/products mutation)
    for (const item of normalizedItems) {
      const prod = products.find(p => p.id === item.id);
      if (!prod) continue;
      if (prod.type === "service") continue;

      if (prod.type === "composed") {
        const res = await updateInventoryForComposedProduct({
          orgId, product: prod, quantity: item.quantity,
          operation: "deduct", referenceId: id, referenceType: "invoice",
          allProducts: products, applyLocalUpdate: applyLocalStockUpdate,
        });
        if (!res.success) {
          console.error("[Context][Invoice][create][composedDeduct]", res.error);
          return null;
        }
      } else {
        // simple product
        applyLocalStockUpdate(prod.id, -item.quantity);
        await recordStockMovement({
          orgId, product: { ...prod }, delta: -item.quantity,
          type: "sale", referenceId: id, referenceType: "invoice",
        });
      }
    }

    setInvoices(prev => [...prev, newInvoice]);

    // Insert invoice + items
    const pm = (invoice as any).paymentMethod || (invoice as any).payment_method || null;
    const initialStatus = pm && ['omt','wish','bank'].includes(pm) ? 'pending_manual_payment' : 'draft';
    (newInvoice as any).status = initialStatus;
    (newInvoice as any).paymentMethod = pm;
    const okInv = await dbInsert('invoices', {
      id, user_id: userId, organization_id: orgId, date,
      client_id: invoicePayload.clientId || null, client_name: invoicePayload.clientName,
      items: normalizedItems, amount: invoice.amount, currency: invoice.currency,
      status: initialStatus, tax: invoice.tax || 0, discount: invoice.discount || 0,
      total: invoice.total || 0, template: invoice.template || null, notes: invoice.notes || null,
      payment_method: pm,
    }, 'Context][Invoice');

    if (!okInv) {
      // Rollback optimistic invoice + restore stock that we already deducted.
      setInvoices(prev => prev.filter(i => i.id !== id));
      for (const item of normalizedItems) {
        const prod = products.find(p => p.id === item.id);
        if (!prod || prod.type === "service") continue;
        if (prod.type === "composed") {
          await updateInventoryForComposedProduct({
            orgId, product: prod, quantity: item.quantity,
            operation: "restore", referenceId: id, referenceType: "invoice_rollback",
            allProducts: products, applyLocalUpdate: applyLocalStockUpdate,
          });
        } else {
          applyLocalStockUpdate(prod.id, item.quantity);
        }
      }
      return null;
    }

    incrementDocumentCount("invoices");

    const itemRows = normalizedItems.map(it => ({
      organization_id: orgId, invoice_id: id, product_id: it.id || null,
      name: it.description, quantity: it.quantity, unit_price: it.unitPrice,
      raw_cost: it.rawPrice || 0, subtotal: it.subtotal,
    }));
    await dbBulkInsert('invoice_items', itemRows, 'Context][InvoiceItems');

    if (orgId && initialStatus !== 'draft') {
      void glSyncInvoiceGl(orgId, { ...newInvoice, status: initialStatus, paymentMethod: pm || undefined } as Invoice);
    }

    // ===== PSA link-back: mark linked timesheet entries as invoiced =====
    // Detect timesheet-sourced items explicitly via item.meta.source === "timesheet".
    try {
      const ALLOWED_SOURCES = ["timesheet"];
      const safeItems = (normalizedItems as any[]).filter(
        (it) => it?.meta?.source && ALLOWED_SOURCES.includes(it.meta.source)
      );
      const rawTsIds = safeItems
        .filter((it) => it?.meta?.source === "timesheet" && typeof it.id === "string")
        .map((it) => it.id as string);
      const uniqueTsIds = [...new Set(rawTsIds)];

      if (uniqueTsIds.length > 0) {
        let linkError: any = null;
        try {
          const { error: tsErr } = await supabase
            .from('timesheets' as any)
            .update({ invoiced: true, invoice_id: id } as any)
            .in('id', uniqueTsIds)
            .eq('invoiced', false);
          if (tsErr) {
            linkError = tsErr;
            console.error("[Context][Invoice][create][timesheetLink] CRITICAL: Timesheet linking failed", tsErr);
            const { error: syncErr } = await supabase
              .from('timesheets' as any)
              .update({ needs_sync: true } as any)
              .in('id', uniqueTsIds);
            if (syncErr) console.error("[Context][Invoice][create][timesheetLink] needs_sync flag failed", syncErr);
          }
        } catch (e: any) {
          linkError = e;
          console.error("[Context][Invoice][create][timesheetLink] CRITICAL: Timesheet linking crashed", e);
          try {
            await supabase
              .from('timesheets' as any)
              .update({ needs_sync: true } as any)
              .in('id', uniqueTsIds);
          } catch (e2) {
            console.error("[Context][Invoice][create][timesheetLink] needs_sync flag crashed", e2);
          }
        }

        // Audit log
        try {
          await supabase.from('psa_audit_logs' as any).insert({
            organization_id: orgId,
            invoice_id: id,
            timesheet_ids: uniqueTsIds,
            status: linkError ? "failed" : "success",
            error: linkError ? (linkError.message || String(linkError)) : null,
          } as any);
        } catch (auditErr) {
          console.error("[Context][Invoice][create][timesheetLink][audit]", auditErr);
        }
      }
    } catch (e) {
      console.error("[Context][Invoice][create][timesheetLink]", e);
    }

    return id;
  };

  const updateInvoice = (invoiceId: string, data: Partial<Invoice>) => {
    const orgId = getOrgId();
    const prev = invoices.find((i) => i.id === invoiceId);
    const normalizedItems = data.items
      ? data.items.map((item) => ({ ...item, rawPrice: snapshotInvoiceUnitCost(item) }))
      : undefined;
    const normalizedData = normalizedItems ? { ...data, items: normalizedItems } : data;

    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, ...normalizedData } : inv));
    const dbU: any = {};
    if (normalizedData.clientName !== undefined) dbU.client_name = normalizedData.clientName;
    if (normalizedData.clientId !== undefined) dbU.client_id = normalizedData.clientId;
    if (normalizedData.items !== undefined) dbU.items = normalizedData.items;
    if (normalizedData.amount !== undefined) dbU.amount = normalizedData.amount;
    if (normalizedData.currency !== undefined) dbU.currency = normalizedData.currency;
    if (normalizedData.status !== undefined) dbU.status = normalizedData.status;
    if (normalizedData.tax !== undefined) dbU.tax = normalizedData.tax;
    if (normalizedData.discount !== undefined) dbU.discount = normalizedData.discount;
    if (normalizedData.total !== undefined) dbU.total = normalizedData.total;
    if (normalizedData.template !== undefined) dbU.template = normalizedData.template;
    if (normalizedData.notes !== undefined) dbU.notes = normalizedData.notes;
    if (normalizedData.paymentMethod !== undefined) dbU.payment_method = normalizedData.paymentMethod;
    if (normalizedData.paidAmount !== undefined) dbU.paid_amount = normalizedData.paidAmount;
    if (normalizedData.paidAt !== undefined) dbU.paid_at = normalizedData.paidAt;
    if (Object.keys(dbU).length > 0) dbUpdate('invoices', invoiceId, dbU, 'Context][Invoice][update');

    if (orgId) {
      const merged = prev ? { ...prev, ...normalizedData } : null;
      if (merged) void glSyncInvoiceGl(orgId, merged, prev);
    }

    if (normalizedData.items && orgId) {
      dbDeleteWhere('invoice_items', 'invoice_id', invoiceId, 'Context][InvoiceItems][delete');
      const itemRows = normalizedData.items.map(it => ({
        organization_id: orgId, invoice_id: invoiceId, product_id: it.id || null,
        name: it.description, quantity: it.quantity, unit_price: it.unitPrice,
        raw_cost: it.rawPrice || 0, subtotal: it.subtotal,
      }));
      dbBulkInsert('invoice_items', itemRows, 'Context][InvoiceItems][replace');
    }
  };

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const recordInvoicePayment = (invoiceId: string, amount: number, paymentMethod = 'cash') => {
    const orgId = getOrgId();
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice || !orgId) return;

    const payAmt = round2(amount);
    if (payAmt <= 0) return;

    const total = round2(invoice.total ?? invoice.amount ?? 0);
    const prevPaid = round2(invoice.paidAmount || 0);
    const nextPaid = round2(Math.min(total, prevPaid + payAmt));
    const newStatus = nextPaid >= total ? 'paid' : 'partial';
    const paidAt = new Date().toISOString();
    const method = paymentMethod || invoice.paymentMethod || 'cash';

    const paymentId = `PAY-INV-${Date.now()}`;
    const payment: Payment = {
      id: paymentId,
      invoiceId,
      amount: payAmt,
      paymentMethod: method,
      paymentDate: paidAt,
    };

    setPayments((prev) => [...prev, payment]);
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, paidAmount: nextPaid, status: newStatus, paymentMethod: method, paidAt }
          : inv,
      ),
    );

    dbInsert('payments', {
      id: paymentId,
      organization_id: orgId,
      invoice_id: invoiceId,
      amount: payAmt,
      payment_method: method,
      payment_date: paidAt,
    }, 'Context][InvoicePayment]');

    dbUpdate('invoices', invoiceId, {
      paid_amount: nextPaid,
      status: newStatus,
      payment_method: method,
      paid_at: paidAt,
    }, 'Context][Invoice][payment]');

    const merged: Invoice = { ...invoice, paidAmount: nextPaid, status: newStatus, paymentMethod: method, paidAt };
    void glSyncInvoiceGl(orgId, merged, invoice);
  };

  const deleteInvoice = async (invoiceId: string) => {
    const orgId = getOrgId();
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice && orgId) {
      // Restore stock via helpers ONLY
      for (const item of invoice.items) {
        const prod = products.find(p => p.id === item.id);
        if (!prod) continue;
        if (prod.type === "service") continue;

        if (prod.type === "composed") {
          const res = await updateInventoryForComposedProduct({
            orgId, product: prod, quantity: item.quantity,
            operation: "restore", referenceId: invoiceId, referenceType: "invoice_delete",
            allProducts: products, applyLocalUpdate: applyLocalStockUpdate,
          });
          if (!res.success) console.error("[Context][Invoice][delete][composedRestore]", res.error);
        } else {
          applyLocalStockUpdate(prod.id, item.quantity);
          await recordStockMovement({
            orgId, product: { ...prod }, delta: item.quantity,
            type: "adjustment", referenceId: invoiceId, referenceType: "invoice_delete",
          });
        }
      }
    }
    setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    await dbDelete('invoices', invoiceId, 'Context][Invoice][delete');
    await dbDeleteWhere('invoice_items', 'invoice_id', invoiceId, 'Context][InvoiceItems][delete');
  };

  // ===== CRUD: Estimates =====
  const createEstimate = async (estimate: Omit<Estimate, "id" | "date" | "status">): Promise<string | null> => {
    const userId = getUserId(); const orgId = getOrgId();
    if (!guardOrg(orgId, userId)) return null;
    const limitCheck = checkLimit("estimates");
    if (!limitCheck.allowed) { toast.error(limitCheck.message || "Monthly estimate limit reached."); return null; }

    const resolvedClientId = await resolveClientId(clients, addClient, estimate.clientId, estimate.clientName);
    const syncedItems = await syncLineItemsToCatalog(products, addProduct, estimate.items);
    const estimatePayload = {
      ...estimate,
      clientId: resolvedClientId,
      items: syncedItems,
    };

    const id = `EST-${Date.now()}`;
    const date = new Date().toISOString();
    const optimistic: Estimate = { ...estimatePayload, id, date, status: "pending" };
    setEstimates(prev => [...prev, optimistic]);

    const ok = await dbInsert('estimates', {
      id, user_id: userId, organization_id: orgId, date,
      client_id: estimatePayload.clientId || null, client_name: estimatePayload.clientName,
      items: estimatePayload.items, amount: estimate.amount, currency: estimate.currency,
      status: 'pending', expiry_date: estimate.expiryDate || null, notes: estimate.notes || null,
    }, 'Context][Estimate');

    if (!ok) {
      // Roll back optimistic insert; dbInsert already surfaced the real error toast.
      setEstimates(prev => prev.filter(e => e.id !== id));
      return null;
    }

    incrementDocumentCount("estimates");

    const itemRows = estimatePayload.items.map(it => ({
      organization_id: orgId, estimate_id: id, product_id: it.id || null,
      name: it.description, quantity: it.quantity, unit_price: it.unitPrice,
      raw_cost: it.rawPrice || 0, subtotal: it.subtotal,
    }));
    if (itemRows.length > 0) await dbBulkInsert('estimate_items', itemRows, 'Context][EstimateItems');

    return id;
  };

  const updateEstimate = (estimateId: string, data: Partial<Estimate>) => {
    const orgId = getOrgId();
    setEstimates(prev => prev.map(e => e.id === estimateId ? { ...e, ...data } : e));
    const dbU: any = {};
    if (data.clientName !== undefined) dbU.client_name = data.clientName;
    if (data.clientId !== undefined) dbU.client_id = data.clientId;
    if (data.items !== undefined) dbU.items = data.items;
    if (data.amount !== undefined) dbU.amount = data.amount;
    if (data.currency !== undefined) dbU.currency = data.currency;
    if (data.status !== undefined) dbU.status = data.status;
    if (data.expiryDate !== undefined) dbU.expiry_date = data.expiryDate;
    if (data.notes !== undefined) dbU.notes = data.notes;
    if (data.tax !== undefined) dbU.tax = data.tax;
    if (data.discount !== undefined) dbU.discount = data.discount;
    if (Object.keys(dbU).length > 0) dbUpdate('estimates', estimateId, dbU, 'Context][Estimate][update');

    if (data.items && orgId) {
      dbDeleteWhere('estimate_items', 'estimate_id', estimateId, 'Context][EstimateItems][delete');
      const itemRows = data.items.map(it => ({
        organization_id: orgId, estimate_id: estimateId, product_id: it.id || null,
        name: it.description, quantity: it.quantity, unit_price: it.unitPrice,
        raw_cost: it.rawPrice || 0, subtotal: it.subtotal,
      }));
      dbBulkInsert('estimate_items', itemRows, 'Context][EstimateItems][replace');
    }
  };

  const deleteEstimate = (estimateId: string) => {
    setEstimates(prev => prev.filter(e => e.id !== estimateId));
    dbDelete('estimates', estimateId, 'Context][Estimate][delete');
    dbDeleteWhere('estimate_items', 'estimate_id', estimateId, 'Context][EstimateItems][delete');
  };

  const convertEstimateToInvoice = async (estimateId: string): Promise<boolean> => {
    const userId = getUserId(); const orgId = getOrgId();
    if (!userId || !orgId) return false;
    const estimate = estimates.find(e => e.id === estimateId);
    if (!estimate) return false;
    const limitCheck = checkLimit("invoices");
    if (!limitCheck.allowed) return false;

    // STRICT validation FIRST — abort if any product/composed lacks stock
    for (const item of estimate.items) {
      const prod = products.find(p => p.id === item.id);
      if (!prod || prod.type === "service") continue;
      if (prod.stockQuantity === undefined) continue;
      if (prod.stockQuantity < item.quantity) {
        console.error(`[Context][Convert][validation] Insufficient stock for ${prod.name}`);
        return false;
      }
    }

    const id = `INV-${Date.now()}`;
    const date = new Date().toISOString();

    // Snapshot unit cost once at invoice creation time (forward-only COGS).
    const normalizedItems: LineItem[] = estimate.items.map(item => {
      const unitCost = snapshotInvoiceUnitCost(item);
      return { ...item, rawPrice: unitCost };
    });

    // Stock deductions via helpers ONLY
    for (const item of normalizedItems) {
      const prod = products.find(p => p.id === item.id);
      if (!prod || prod.type === "service") continue;

      if (prod.type === "composed") {
        const res = await updateInventoryForComposedProduct({
          orgId, product: prod, quantity: item.quantity,
          operation: "deduct", referenceId: id, referenceType: "estimate_convert",
          allProducts: products, applyLocalUpdate: applyLocalStockUpdate,
        });
        if (!res.success) {
          console.error("[Context][Convert][composedDeduct]", res.error);
          return false;
        }
      } else {
        applyLocalStockUpdate(prod.id, -item.quantity);
        await recordStockMovement({
          orgId, product: { ...prod }, delta: -item.quantity,
          type: "sale", referenceId: id, referenceType: "estimate_convert",
        });
      }
    }

    const newInvoice: Invoice = {
      id, date, clientId: estimate.clientId, clientName: estimate.clientName,
      items: normalizedItems, amount: estimate.amount, currency: estimate.currency,
      status: "draft", notes: estimate.notes,
    };
    setInvoices(prev => [...prev, newInvoice]);
    incrementDocumentCount("invoices");

    await dbInsert('invoices', {
      id, user_id: userId, organization_id: orgId, date,
      client_id: estimate.clientId || null, client_name: estimate.clientName,
      items: normalizedItems, amount: estimate.amount, currency: estimate.currency,
      status: 'draft', notes: estimate.notes || null,
    }, 'Context][Convert');

    const itemRows = normalizedItems.map(it => ({
      organization_id: orgId, invoice_id: id, product_id: it.id || null,
      name: it.description, quantity: it.quantity, unit_price: it.unitPrice,
      raw_cost: it.rawPrice || 0, subtotal: it.subtotal,
    }));
    await dbBulkInsert('invoice_items', itemRows, 'Context][Convert][Items');

    return true;
  };

  // ===== CRUD: Receipts =====
  const createReceipt = async (receipt: Omit<Receipt, "id" | "date">): Promise<string | null> => {
    const userId = getUserId(); const orgId = getOrgId();
    if (!guardOrg(orgId, userId)) return null;
    const limitCheck = checkLimit("receipts");
    if (!limitCheck.allowed) { toast.error(limitCheck.message || "Monthly receipt limit reached."); return null; }

    const id = `REC-${Date.now()}`;
    const date = new Date().toISOString();
    const optimistic: Receipt = { ...receipt, id, date };
    setReceipts(prev => [...prev, optimistic]);

    const ok = await dbInsert('receipts', {
      id, user_id: userId, organization_id: orgId, date,
      client_id: receipt.clientId || null, client_name: receipt.clientName || '',
      amount: receipt.amount, payment_date: receipt.paymentDate || null,
      payment_method: receipt.paymentMethod || '', currency: receipt.currency,
      notes: receipt.notes || null, category: receipt.category || null,
      vendor: receipt.vendor || null, items: receipt.items || [],
    }, 'Context][Receipt');
    if (!ok) { setReceipts(prev => prev.filter(r => r.id !== id)); return null; }
    incrementDocumentCount("receipts");
    return id;
  };

  const updateReceipt = (receiptId: string, data: Partial<Receipt>) => {
    setReceipts(prev => prev.map(r => r.id === receiptId ? { ...r, ...data } : r));
    const dbU: any = {};
    if (data.clientName !== undefined) dbU.client_name = data.clientName;
    if (data.clientId !== undefined) dbU.client_id = data.clientId;
    if (data.amount !== undefined) dbU.amount = data.amount;
    if (data.paymentDate !== undefined) dbU.payment_date = data.paymentDate;
    if (data.paymentMethod !== undefined) dbU.payment_method = data.paymentMethod;
    if (data.currency !== undefined) dbU.currency = data.currency;
    if (data.notes !== undefined) dbU.notes = data.notes;
    if (data.category !== undefined) dbU.category = data.category;
    if (data.vendor !== undefined) dbU.vendor = data.vendor;
    if (data.items !== undefined) dbU.items = data.items;
    if (Object.keys(dbU).length > 0) dbUpdate('receipts', receiptId, dbU, 'Context][Receipt][update');
  };

  const deleteReceipt = (receiptId: string) => {
    setReceipts(prev => prev.filter(r => r.id !== receiptId));
    dbDelete('receipts', receiptId, 'Context][Receipt][delete');
  };

  // ===== CRUD: Purchase Orders =====
  const createPurchaseOrder = async (po: Omit<PurchaseOrder, "id" | "date" | "status">): Promise<string | null> => {
    const userId = getUserId(); const orgId = getOrgId();
    if (!guardOrg(orgId, userId)) return null;
    const limitCheck = checkLimit("purchaseOrders");
    if (!limitCheck.allowed) { toast.error(limitCheck.message || "Monthly purchase-order limit reached."); return null; }

    const resolvedSupplierId = await resolveSupplierId(suppliers, addSupplier, po.supplierId, po.supplierName);
    const syncedItems = await syncLineItemsToCatalog(products, addProduct, po.items);
    const poPayload = { ...po, supplierId: resolvedSupplierId, items: syncedItems };

    const id = `PO-${Date.now()}`;
    const date = new Date().toISOString();

    // Insert PO FIRST. Only mutate stock on success to avoid phantom adjustments.
    const okPO = await dbInsert('purchase_orders', {
      id, user_id: userId, organization_id: orgId, date,
      supplier_id: poPayload.supplierId || null, supplier_name: poPayload.supplierName,
      items: poPayload.items, amount: po.amount, currency: po.currency,
      status: 'draft', notes: po.notes || null,
    }, 'Context][PO');
    if (!okPO) return null;

    // Inventory receiving is owned by Grabio admin Purchases — finance records AP only.
    setPurchaseOrders(prev => [...prev, { ...poPayload, id, date, status: "draft" }]);
    incrementDocumentCount("purchaseOrders");
    return id;
  };

  const updatePurchaseOrder = (poId: string, data: Partial<PurchaseOrder>) => {
    const orgId = getOrgId();
    const prev = purchaseOrders.find((p) => p.id === poId);
    setPurchaseOrders(prev => prev.map(p => p.id === poId ? { ...p, ...data } : p));
    const dbU: any = {};
    if (data.supplierName !== undefined) dbU.supplier_name = data.supplierName;
    if (data.supplierId !== undefined) dbU.supplier_id = data.supplierId;
    if (data.items !== undefined) dbU.items = data.items;
    if (data.amount !== undefined) dbU.amount = data.amount;
    if (data.currency !== undefined) dbU.currency = data.currency;
    if (data.status !== undefined) dbU.status = data.status;
    if (data.notes !== undefined) dbU.notes = data.notes;
    if (Object.keys(dbU).length > 0) dbUpdate('purchase_orders', poId, dbU, 'Context][PO][update');

  };

  const updatePaymentOrder = (poId: string, data: Partial<PaymentOrder>) => {
    const orgId = getOrgId();
    const prev = paymentOrders.find((p) => p.id === poId);
    if (!prev) return;

    const merged = { ...prev, ...data };
    setPaymentOrders(prevList => prevList.map(p => p.id === poId ? merged : p));

    const dbU: Record<string, unknown> = {};
    if (data.supplierName !== undefined) dbU.supplier_name = data.supplierName;
    if (data.supplierId !== undefined) dbU.supplier_id = data.supplierId;
    if (data.amount !== undefined) dbU.amount = data.amount;
    if (data.currency !== undefined) dbU.currency = data.currency;
    if (data.status !== undefined) dbU.status = data.status;
    if (data.paymentMethod !== undefined) dbU.payment_method = data.paymentMethod;
    if (data.notes !== undefined) dbU.notes = data.notes;
    if (data.purchaseOrderId !== undefined) dbU.purchase_order_id = data.purchaseOrderId;
    if (Object.keys(dbU).length > 0) {
      dbUpdate('payment_orders', poId, dbU, 'Context][PaymentOrder][update]');
    }

    if (orgId && data.status === 'paid' && prev.status !== 'paid') {
      void glPostPurchasePayment(orgId, merged);
    }
  };

  const markPaymentOrderPaid = (poId: string, paymentMethod?: string) => {
    updatePaymentOrder(poId, {
      status: 'paid',
      ...(paymentMethod ? { paymentMethod } : {}),
    });
  };

  const deletePurchaseOrder = async (poId: string) => {
    const orgId = getOrgId();
    const po = purchaseOrders.find(p => p.id === poId);
    if (po && orgId) {
      // Reverse stock via helper ONLY
      for (const item of po.items) {
        const prod = products.find(p => p.id === item.id);
        if (!prod || prod.type === "service") continue;
        if (prod.stockQuantity === undefined) continue;
        applyLocalStockUpdate(prod.id, -item.quantity);
        await recordStockMovement({
          orgId, product: { ...prod }, delta: -item.quantity,
          type: "adjustment", referenceId: poId, referenceType: "po_delete",
        });
      }
    }
    setPurchaseOrders(prev => prev.filter(p => p.id !== poId));
    await dbDelete('purchase_orders', poId, 'Context][PO][delete');
  };

  // ===== CRUD: Clients =====
  const addClient = async (client: Omit<Client, "id">): Promise<string | null> => {
    const userId = getUserId(); const orgId = getOrgId();
    if (!guardOrg(orgId, userId)) return null;
    const limitCheck = checkLimit("clients");
    if (!limitCheck.allowed) { toast.error(limitCheck.message || "Client limit reached."); return null; }

    const id = `CLI-${Date.now()}`;
    setClients(prev => [...prev, { ...client, id }]);
    const ok = await dbInsert('clients', {
      id, user_id: userId, organization_id: orgId,
      name: client.name, address: client.address || '', phone: client.phone || '',
      email: client.email || '', tax_id: client.taxId || '',
    }, 'Context][Client');
    if (!ok) { setClients(prev => prev.filter(c => c.id !== id)); return null; }
    return id;
  };

  const updateClient = (clientId: string, data: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...data } : c));
    const dbU: any = {};
    if (data.name !== undefined) dbU.name = data.name;
    if (data.address !== undefined) dbU.address = data.address;
    if (data.phone !== undefined) dbU.phone = data.phone;
    if (data.email !== undefined) dbU.email = data.email;
    if (data.taxId !== undefined) dbU.tax_id = data.taxId;
    if (Object.keys(dbU).length > 0) dbUpdate('clients', clientId, dbU, 'Context][Client][update');
  };

  const deleteClient = (clientId: string) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
    dbDelete('clients', clientId, 'Context][Client][delete');
  };

  // ===== CRUD: Suppliers =====
  const addSupplier = async (supplier: Omit<Supplier, "id">): Promise<string | null> => {
    const userId = getUserId(); const orgId = getOrgId();
    if (!guardOrg(orgId, userId)) return null;

    const id = `SUP-${Date.now()}`;
    setSuppliers(prev => [...prev, { ...supplier, id }]);
    const ok = await dbInsert('suppliers', {
      id, user_id: userId, organization_id: orgId,
      name: supplier.name, address: supplier.address || '', phone: supplier.phone || '', email: supplier.email || '',
    }, 'Context][Supplier');
    if (!ok) { setSuppliers(prev => prev.filter(s => s.id !== id)); return null; }
    return id;
  };

  const updateSupplier = (supplierId: string, data: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, ...data } : s));
    const dbU: any = {};
    if (data.name !== undefined) dbU.name = data.name;
    if (data.address !== undefined) dbU.address = data.address;
    if (data.phone !== undefined) dbU.phone = data.phone;
    if (data.email !== undefined) dbU.email = data.email;
    if (Object.keys(dbU).length > 0) dbUpdate('suppliers', supplierId, dbU, 'Context][Supplier][update');
  };

  const deleteSupplier = (supplierId: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== supplierId));
    dbDelete('suppliers', supplierId, 'Context][Supplier][delete');
  };

  // ===== CRUD: Products =====
  // Stock is NEVER set at create time. It always defaults to 0 and can only change via
  // purchase orders, manufacture, or explicit inventory adjustments.
  const addProduct = async (product: Omit<Product, "id">): Promise<string | null> => {
    const userId = getUserId(); const orgId = getOrgId();
    if (!guardOrg(orgId, userId)) return null;
    const limitCheck = checkLimit("products");
    if (!limitCheck.allowed) { toast.error(limitCheck.message || "Product limit reached."); return null; }

    const isStockable = product.type === "product" || product.type === "composed";
    const id = `PRD-${Date.now()}`;
    const newProd: Product = { ...product, id, stockQuantity: isStockable ? 0 : undefined };
    setProducts(prev => [...prev, newProd]);

    const ok = await dbInsert('products', {
      id, user_id: userId, organization_id: orgId,
      name: product.name, description: product.description || null, type: product.type,
      sale_price: product.salePrice, raw_price: product.rawPrice || 0,
      stock_quantity: isStockable ? 0 : null,
      low_stock_alert: product.lowStockAlert || 10, sku: product.sku || null,
      category: product.category || null, components: product.components || [],
      service_cost: product.serviceCost || 0,
    }, 'Context][Product');
    if (!ok) { setProducts(prev => prev.filter(p => p.id !== id)); return null; }
    return id;
  };

  const updateProduct = (productId: string, data: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...data } : p));
    const dbU: any = {};
    if (data.name !== undefined) dbU.name = data.name;
    if (data.description !== undefined) dbU.description = data.description;
    if (data.type !== undefined) dbU.type = data.type;
    if (data.salePrice !== undefined) dbU.sale_price = data.salePrice;
    if (data.rawPrice !== undefined) dbU.raw_price = data.rawPrice;
    if (data.stockQuantity !== undefined) dbU.stock_quantity = data.stockQuantity;
    if (data.lowStockAlert !== undefined) dbU.low_stock_alert = data.lowStockAlert;
    if (data.sku !== undefined) dbU.sku = data.sku;
    if (data.category !== undefined) dbU.category = data.category;
    if (data.components !== undefined) dbU.components = data.components;
    if (data.serviceCost !== undefined) dbU.service_cost = data.serviceCost;
    if (Object.keys(dbU).length > 0) dbUpdate('products', productId, dbU, 'Context][Product][update');
  };

  const deleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    dbDelete('products', productId, 'Context][Product][delete');
  };

  // ===== Manufacture (delegates to inventoryLogic) =====
  const manufactureProduct = async (
    composedProductId: string,
    quantity: number,
  ): Promise<{ success: boolean; error?: string }> => {
    const orgId = getOrgId();
    if (!orgId) return { success: false, error: "No active organization" };
    const composedProduct = products.find(p => p.id === composedProductId);
    if (!composedProduct) return { success: false, error: "Composed product not found" };
    if (composedProduct.type !== "composed") return { success: false, error: "Only composed products can be manufactured" };

    const applyLocalUpdate = (productId: string, delta: number) => {
      setProducts(prev => prev.map(p =>
        p.id === productId && p.stockQuantity !== undefined
          ? { ...p, stockQuantity: p.stockQuantity + delta }
          : p,
      ));
    };

    if (!composedProduct.components?.length) {
      return { success: false, error: "No components defined" };
    }
    for (const comp of composedProduct.components) {
      const raw = products.find(p => p.id === comp.productId);
      const need = comp.quantity * quantity;
      if (!raw) return { success: false, error: `Component "${comp.productName}" not found` };
      if (raw.stockQuantity === undefined || raw.stockQuantity < need) {
        return {
          success: false,
          error: `Insufficient stock for "${comp.productName}". Need ${need}, have ${raw.stockQuantity ?? 0}`,
        };
      }
    }

    const res = await updateInventoryForComposedProduct({
      orgId,
      product: composedProduct,
      quantity,
      operation: "manufacture",
      referenceId: composedProductId,
      referenceType: "manufacture",
      allProducts: products,
      applyLocalUpdate,
    });
    if (!res.success) {
      console.error("[Context][Manufacture]", res.error);
      return { success: false, error: res.error };
    }
    return { success: true };
  };

  // ===== Payment Orders (Firestore; GL posts on status → paid) =====
  const createPaymentOrder = (
    po: Omit<PaymentOrder, "id" | "date" | "status"> & { status?: PaymentOrder['status'] },
  ): string | null => {
    const userId = getUserId();
    const orgId = getOrgId();
    if (!guardOrg(orgId, userId)) return null;

    const initialStatus = po.status || 'draft';
    const { status: _s, ...rest } = po;
    const newPO: PaymentOrder = {
      ...rest,
      id: `PAY-${Date.now()}`,
      date: new Date().toISOString(),
      status: initialStatus,
    };
    setPaymentOrders(prev => [...prev, newPO]);

    void dbInsert('payment_orders', {
      id: newPO.id,
      user_id: userId,
      organization_id: orgId,
      supplier_id: newPO.supplierId || null,
      supplier_name: newPO.supplierName,
      amount: newPO.amount,
      currency: newPO.currency,
      status: newPO.status,
      payment_method: newPO.paymentMethod || 'bank',
      notes: newPO.notes || null,
      purchase_order_id: newPO.purchaseOrderId || null,
      date: newPO.date,
    }, 'Context][PaymentOrder]');

    if (orgId && initialStatus === 'paid') {
      void glPostPurchasePayment(orgId, newPO);
    }
    return newPO.id;
  };

  // ===== Misc =====
  const login = () => true;
  const logout = async () => {
    await firebaseSignOut(getFinanceAuth()).catch(() => {});
    if (USE_SUPABASE_LEGACY) await supabase.auth.signOut().catch(() => {});
    setUser(null); setIsLoggedIn(false); localStorage.removeItem("user");
  };

  const updateCompanyProfile = (companyData: Partial<Company>) => {
    const docPatch: Partial<FinanceDocumentSettings> = {};
    if (companyData.primaryColor !== undefined) docPatch.primaryColor = companyData.primaryColor;
    if (companyData.secondaryColor !== undefined) docPatch.secondaryColor = companyData.secondaryColor;
    if (companyData.invoiceTemplate !== undefined) docPatch.invoiceTemplate = companyData.invoiceTemplate;
    if (companyData.signature !== undefined) docPatch.signature = companyData.signature;

    if (Object.keys(docPatch).length === 0) {
      console.warn('[updateCompanyProfile] Company identity fields are edited in Grabio Admin Profile only.');
      return;
    }

    const storeId = orgIdRef.current;
    if (storeId) {
      void updateFinanceDocumentSettings(storeId, docPatch).catch((err) => {
        console.error('[updateCompanyProfile][Firestore]', err);
        toast.error('Failed to save document settings.');
      });
    }

    setUser(prev => prev ? { ...prev, company: { ...prev.company, ...docPatch } } : prev);
  };

  const addPortfolioItem = (item: Omit<PortfolioItem, "id">) => {
    setPortfolioItems(prev => [...prev, { ...item, id: `PORT-${Date.now()}` }]);
  };

  const upgradeAccount = () => {
    // Disabled: plan upgrades must be processed server-side via verified payment.
    console.warn('[upgradeAccount] Disabled: use verified payment flow.');
  };
  const setDemoMode = (enabled: boolean) => setUser(prev => prev ? { ...prev, isDemoAccount: enabled } : prev);
  const toggleDeveloperProMode = () => setUser(prev => prev ? { ...prev, plan: prev.plan === "pro" ? "free" : "pro" } : prev);
  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  const updatePassword = () => true;
  const updateEmail = (email: string, password: string) => {
    if (user && password) { setUser({ ...user, email }); return true; }
    return false;
  };
  const addSubUser = (email: string, role: "Editor" | "Co-Admin") => {
    setUser(prev => prev ? {
      ...prev, subUsers: [...(prev.subUsers || []), { id: `SUB-${Date.now()}`, email, name: email.split("@")[0], role }]
    } : prev);
  };

  // Preview functions
  const previewInvoice = (id: string) => invoices.find(inv => inv.id === id) || null;
  const previewEstimate = (id: string) => estimates.find(e => e.id === id) || null;
  const previewReceipt = (id: string) => receipts.find(r => r.id === id) || null;
  const previewPaymentOrder = (id: string) => paymentOrders.find(po => po.id === id) || null;
  const previewPurchaseOrder = (id: string) => purchaseOrders.find(po => po.id === id) || null;

  // Build a context snapshot for documentLogic helpers
  const buildDocCtx = () => ({
    invoices, estimates, receipts, purchaseOrders, paymentOrders,
    clients, suppliers,
    organization: organizations.find(o => o.id === activeOrganizationId) || null,
    companyFallback: user?.company,
  });

  const runDocumentAction = async (
    action: () => boolean | Promise<boolean>,
  ): Promise<boolean> => {
    await refreshDocumentCompany();
    return action();
  };

  // ===== Send document via email (PDF + mailto handoff) =====
  const sendInvoice = (id: string, email: string) =>
    runDocumentAction(() => sendDocumentEmail("invoice", id, email, buildDocCtx()));
  const sendEstimate = (id: string, email: string) =>
    runDocumentAction(() => sendDocumentEmail("estimate", id, email, buildDocCtx()));
  const sendReceipt = (id: string, email: string) =>
    runDocumentAction(() => sendDocumentEmail("receipt", id, email, buildDocCtx()));
  const sendPaymentOrder = (id: string, email: string) =>
    runDocumentAction(() => sendDocumentEmail("paymentOrder", id, email, buildDocCtx()));
  const sendPurchaseOrder = (id: string, email: string) =>
    runDocumentAction(() => sendDocumentEmail("purchaseOrder", id, email, buildDocCtx()));

  // ===== Export PDF (delegates to documentLogic.generatePDF) =====
  const exportInvoiceAsPdf = (id: string) =>
    runDocumentAction(() => generatePDF("invoice", id, buildDocCtx()));
  const exportEstimateAsPdf = (id: string) =>
    runDocumentAction(() => generatePDF("estimate", id, buildDocCtx()));
  const exportReceiptAsPdf = (id: string) =>
    runDocumentAction(() => generatePDF("receipt", id, buildDocCtx()));
  const exportPaymentOrderAsPdf = (id: string) =>
    runDocumentAction(() => generatePDF("paymentOrder", id, buildDocCtx()));
  const exportPurchaseOrderAsPdf = (id: string) =>
    runDocumentAction(() => generatePDF("purchaseOrder", id, buildDocCtx()));

  const getDocumentPdfFile = (documentType: DocumentType, documentId: string): Promise<File | null> =>
    generatePdfFile(documentType, documentId, buildDocCtx());

  const updateSettings = (settings: any) => contextLog("Settings updated:", settings);

  // ===== PSA: Build invoice draft from project's billable, uninvoiced timesheets =====
  const generateInvoiceDraftFromProject = async (
    projectId: string
  ): Promise<InvoiceDraftFromProject | null> => {
    const orgId = getOrgId();
    if (!orgId) { console.error("[Context][PSA][draft] No org"); return null; }
    try {
      // Fetch billable, uninvoiced timesheets for this project
      const { data: tsRows, error: tsErr } = await supabase
        .from('timesheets' as any)
        .select('*')
        .eq('project_id', projectId)
        .eq('is_billable', true)
        .eq('invoiced', false);
      if (tsErr) { console.error("[Context][PSA][draft]", tsErr); return null; }
      if (!tsRows || tsRows.length === 0) return null;

      // Fetch project for client linkage + currency hint
      const { data: project, error: pErr } = await supabase
        .from('projects' as any)
        .select('id, client_id, client_name, budget_currency')
        .eq('id', projectId)
        .maybeSingle();
      if (pErr) console.error("[Context][PSA][draft][project]", pErr);

      const items: LineItem[] = (tsRows as any[]).map((te) => {
        const qty = Number(te.hours) || 0;
        const price = Number(te.rate) || 0;
        return {
          id: te.id,
          description: `${te.description || te.staff_name || 'Time entry'} (${te.work_date})`,
          quantity: qty,
          unitPrice: price,
          rawPrice: 0,
          subtotal: qty * price,
          meta: { source: "timesheet" as const },
        } as any;
      });

      const amount = items.reduce((s, it) => s + it.subtotal, 0);
      const currency =
        (tsRows as any[])[0]?.rate_currency ||
        (project as any)?.budget_currency ||
        'USD';

      const clientId = (project as any)?.client_id || undefined;
      const clientName = (project as any)?.client_name || '';

      return {
        clientId,
        clientName,
        items,
        amount,
        currency,
        _timesheetIds: (tsRows as any[]).map(t => t.id),
      };
    } catch (e) {
      console.error("[Context][PSA][draft]", e);
      return null;
    }
  };

  // ===== PSA: Retry timesheets flagged needs_sync =====
  const retryFailedTimesheets = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('timesheets' as any)
        .select('id, invoice_id')
        .eq('needs_sync', true)
        .not('invoice_id', 'is', null)
        .limit(50);
      if (error) {
        console.error("[Context][PSA][retry] fetch failed", error);
        return;
      }
      if (!data?.length) return;

      // Group rows by invoice_id
      const groups = (data as any[]).reduce<Record<string, string[]>>((acc, row) => {
        const inv = row.invoice_id as string;
        if (!acc[inv]) acc[inv] = [];
        acc[inv].push(row.id);
        return acc;
      }, {});

      for (const invoiceId of Object.keys(groups)) {
        const ids = groups[invoiceId];
        const { error: linkErr } = await supabase
          .from('timesheets' as any)
          .update({ invoiced: true } as any)
          .in('id', ids)
          .eq('invoiced', false);
        if (linkErr) {
          console.error("[Context][PSA][retry] link failed", linkErr);
          continue;
        }
        const { error: clearErr } = await supabase
          .from('timesheets' as any)
          .update({ needs_sync: false } as any)
          .in('id', ids);
        if (clearErr) console.error("[Context][PSA][retry] clear needs_sync failed", clearErr);
      }
    } catch (e) {
      console.error("[Context][PSA][retry] crashed", e);
    }
  };

  const importSimMigration = async (migration: SimMigrationData): Promise<SimImportRunSummary> => {
    const userId = getUserId();
    const orgId = getOrgId();
    const result: SimImportRunSummary = {
      clients: 0,
      products: 0,
      invoices: 0,
      receipts: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    if (!guardOrg(orgId, userId)) {
      result.failed++;
      result.errors.push("No signed-in user or active organization.");
      return result;
    }

    const clientKeys = new Set(clients.map(c => `${c.id}|${c.name.trim().toLowerCase()}`));
    for (const client of migration.clients) {
      const key = `${client.id}|${client.name.trim().toLowerCase()}`;
      if (clientKeys.has(key)) { result.skipped++; continue; }
      const ok = await dbInsert('clients', {
        id: client.id, user_id: userId, organization_id: orgId,
        name: client.name, address: client.address || '', phone: client.phone || '',
        email: client.email || '', tax_id: client.taxId || '',
      }, 'Context][SIM][Client]');
      if (!ok) { result.failed++; result.errors.push(`Client failed: ${client.name}`); continue; }
      setClients(prev => [...prev, {
        id: client.id, name: client.name, address: client.address,
        phone: client.phone, email: client.email, taxId: client.taxId,
      }]);
      clientKeys.add(key);
      result.clients++;
    }

    const productKeys = new Set(products.map(p => `${p.id}|${(p.sku || p.name).trim().toLowerCase()}`));
    for (const product of migration.products) {
      const key = `${product.id}|${(product.sku || product.name).trim().toLowerCase()}`;
      if (productKeys.has(key)) { result.skipped++; continue; }
      const ok = await dbInsert('products', {
        id: product.id, user_id: userId, organization_id: orgId,
        name: product.name, description: product.description || null, type: product.type,
        sale_price: product.salePrice, raw_price: product.rawPrice || 0,
        stock_quantity: product.type === "product" ? product.stockQuantity || 0 : null,
        low_stock_alert: product.lowStockAlert || 10, sku: product.sku || null,
        category: product.category || null, components: [],
        service_cost: 0,
      }, 'Context][SIM][Product]');
      if (!ok) { result.failed++; result.errors.push(`Product failed: ${product.name}`); continue; }
      setProducts(prev => [...prev, {
        id: product.id, name: product.name, description: product.description,
        type: product.type, salePrice: product.salePrice, rawPrice: product.rawPrice,
        stockQuantity: product.type === "product" ? product.stockQuantity || 0 : undefined,
        lowStockAlert: product.lowStockAlert, sku: product.sku, category: product.category,
      }]);
      productKeys.add(key);
      result.products++;
    }

    const invoiceIds = new Set(invoices.map(i => i.id));
    for (const invoice of migration.invoices) {
      if (invoiceIds.has(invoice.id)) { result.skipped++; continue; }
      const items: LineItem[] = invoice.items.map(item => ({
        id: item.productId || item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        rawPrice: item.rawPrice,
        subtotal: item.subtotal,
      }));
      const ok = await dbInsert('invoices', {
        id: invoice.id, user_id: userId, organization_id: orgId, date: invoice.date,
        client_id: invoice.clientId || null, client_name: invoice.clientName,
        items, amount: invoice.amount, currency: invoice.currency,
        status: invoice.status, tax: invoice.tax || 0, discount: invoice.discount || 0,
        total: invoice.total || invoice.amount, template: null,
        notes: [invoice.notes, `Imported from SIM invoice ${invoice.originalNumber}`].filter(Boolean).join("\n"),
        payment_method: null,
      }, 'Context][SIM][Invoice]');
      if (!ok) { result.failed++; result.errors.push(`Invoice failed: ${invoice.originalNumber}`); continue; }
      const itemRows = items.map(it => ({
        organization_id: orgId, invoice_id: invoice.id, product_id: it.id || null,
        name: it.description, quantity: it.quantity, unit_price: it.unitPrice,
        raw_cost: it.rawPrice || 0, subtotal: it.subtotal,
      }));
      await dbBulkInsert('invoice_items', itemRows, 'Context][SIM][InvoiceItems');
      setInvoices(prev => [...prev, {
        id: invoice.id, date: invoice.date, clientId: invoice.clientId,
        clientName: invoice.clientName, items, amount: invoice.amount,
        currency: invoice.currency, status: invoice.status, tax: invoice.tax,
        discount: invoice.discount, total: invoice.total || invoice.amount,
        notes: invoice.notes,
      }]);
      invoiceIds.add(invoice.id);
      result.invoices++;
    }

    const receiptIds = new Set(receipts.map(r => r.id));
    for (const receipt of migration.receipts) {
      if (receiptIds.has(receipt.id)) { result.skipped++; continue; }
      const notes = [receipt.notes, receipt.invoiceExternalId ? `Imported SIM payment for invoice ${receipt.invoiceExternalId}` : ""]
        .filter(Boolean)
        .join("\n");
      const ok = await dbInsert('receipts', {
        id: receipt.id, user_id: userId, organization_id: orgId, date: receipt.date,
        client_id: receipt.clientId || null, client_name: receipt.clientName || '',
        amount: receipt.amount, payment_date: receipt.paymentDate || null,
        payment_method: receipt.paymentMethod || 'imported', currency: receipt.currency,
        notes: notes || null, category: null, vendor: null, items: [],
      }, 'Context][SIM][Receipt]');
      if (!ok) { result.failed++; result.errors.push(`Receipt failed: ${receipt.externalId}`); continue; }
      setReceipts(prev => [...prev, {
        id: receipt.id, date: receipt.date, clientId: receipt.clientId,
        clientName: receipt.clientName, amount: receipt.amount,
        paymentDate: receipt.paymentDate, paymentMethod: receipt.paymentMethod,
        currency: receipt.currency, notes,
      }]);
      receiptIds.add(receipt.id);
      result.receipts++;
    }

    return result;
  };

  const value: AppContextType = {
    user, invoices, receipts, estimates, clients, suppliers, products,
    portfolioItems, paymentOrders, purchaseOrders, payments, expenses,
    isLoggedIn, isDarkMode,
    activeOrganizationId, organizations, setActiveOrganizationId,
    currentUserRole, inviteUserToOrg, listOrgMembers, removeOrgMember,
    updateMemberRole, updateOrgPlan, hasPermission,
    financialSummary, accountingSummary,
    login, logout, createInvoice, createEstimate, convertEstimateToInvoice,
    createReceipt, createPaymentOrder, createPurchaseOrder,
    updateCompanyProfile, addClient, addSupplier, addProduct, updateProduct, deleteProduct,
    deleteClient, updateClient, deleteSupplier, updateSupplier,
    deleteInvoice, updateInvoice, recordInvoicePayment, deleteEstimate, updateEstimate,
    deletePurchaseOrder, updatePurchaseOrder, updatePaymentOrder, markPaymentOrderPaid, deleteReceipt, updateReceipt,
    addPortfolioItem, manufactureProduct, upgradeAccount, setDemoMode, toggleDeveloperProMode,
    toggleDarkMode, updatePassword, updateEmail, addSubUser,
    previewInvoice, previewEstimate, previewReceipt, previewPaymentOrder, previewPurchaseOrder,
    sendInvoice, sendEstimate, sendReceipt, sendPaymentOrder, sendPurchaseOrder,
    exportInvoiceAsPdf, exportEstimateAsPdf, exportReceiptAsPdf,
    exportPaymentOrderAsPdf, exportPurchaseOrderAsPdf, getDocumentPdfFile,
    updateSettings, reloadStoreProfile, refreshDocumentCompany, checkLimit, getCurrentMonthKey,
    calculateComposedProductCost: calculateComposedProductCostFn,
    generateInvoiceDraftFromProject,
    retryFailedTimesheets,
    importSimMigration,
  };

  if (!authReady) {
    if (embedded) {
      return <div className="py-8 text-center text-sm text-muted-foreground">Loading finance data…</div>;
    }
    return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
