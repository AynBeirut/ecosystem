import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import type { FinanceDocumentSettings, GrabioStoreProfile } from './types';
import {
  mapFinanceInvoiceTemplateToGrabio,
  mapGrabioInvoiceTemplateToFinance,
} from '@/lib/invoiceTemplateMap';

export type ResolvedGrabioStore = {
  storeId: string;
  profile: GrabioStoreProfile;
  role: 'owner' | 'admin' | 'member';
};

export type StoreCompanyView = {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  website?: string;
  taxId?: string;
  commercialRegistry?: string;
  description?: string;
  primaryColor: string;
  secondaryColor: string;
  invoiceTemplate: 'basic' | 'modern' | 'professional';
  signature?: string;
};

async function resolveStoreIdForUser(uid: string): Promise<string> {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (userSnap.exists()) {
    const data = userSnap.data();
    if (data.role === 'sub_account' && data.subAccountId) {
      const subSnap = await getDoc(doc(db, 'subAccounts', data.subAccountId));
      if (subSnap.exists() && subSnap.data().storeId) {
        return String(subSnap.data().storeId);
      }
    }
    const active =
      (typeof data.activeStoreId === 'string' && data.activeStoreId.trim()) ||
      (typeof data.primaryStoreId === 'string' && data.primaryStoreId.trim()) ||
      '';
    if (active) return active;
  }

  const sellerSnap = await getDoc(doc(db, 'sellers', uid));
  if (sellerSnap.exists() && sellerSnap.data().storeId) {
    return String(sellerSnap.data().storeId);
  }

  return uid;
}

function defaultFinanceStoreProfile(uid: string, email: string): GrabioStoreProfile {
  const name = email.split('@')[0] || 'My Business';
  return {
    name,
    ownerId: uid,
    subscriptionTier: 'trial',
    subscriptionStatus: 'trial',
    pricingVersion: 'modular-v2',
    enabledModules: {
      invoicing: true,
      invoice_manager: true,
    },
    contactInfo: { email },
    email,
  };
}

/** Map storeProfiles fields (Grabio main schema) → runtime company view for PDFs/UI. */
export function storeProfileToCompany(profile: GrabioStoreProfile): StoreCompanyView {
  const docSettings = profile.financeDocumentSettings ?? {};
  const primaryColor =
    docSettings.primaryColor ??
    profile.templateColors?.primary ??
    '#38B2AC';
  const secondaryColor =
    docSettings.secondaryColor ??
    profile.templateColors?.highlight ??
    profile.templateColors?.secondary ??
    '#C7D2FE';

  return {
    name: profile.name || profile.storeName || 'My Company',
    address: profile.location || '',
    phone: profile.phone || profile.contactInfo?.phone || '',
    email: profile.email || profile.contactInfo?.email || '',
    logo: profile.logo || '',
    website: profile.website,
    taxId: profile.taxId,
    commercialRegistry: profile.commercialRegistry,
    description: profile.description,
    primaryColor,
    secondaryColor,
    invoiceTemplate: docSettings.invoiceTemplate ?? 'basic',
    signature: docSettings.signature,
  };
}

/** Persist IM document styling only — company identity fields are edited in Grabio Admin Profile. */
export async function updateFinanceDocumentSettings(
  storeId: string,
  patch: Partial<FinanceDocumentSettings>,
): Promise<void> {
  const ref = doc(db, 'storeProfiles', storeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const current = (snap.data() as GrabioStoreProfile).financeDocumentSettings ?? {};
  const merged = { ...current, ...patch };
  const grabioTemplate =
    patch.invoiceTemplate !== undefined
      ? mapFinanceInvoiceTemplateToGrabio(patch.invoiceTemplate)
      : undefined;

  await updateDoc(ref, {
    financeDocumentSettings: merged,
    ...(grabioTemplate ? { invoiceTemplate: grabioTemplate } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** Resolve or bootstrap the Grabio store for a Firebase user. */
export async function resolveGrabioStore(uid: string, email: string): Promise<ResolvedGrabioStore> {
  const storeId = await resolveStoreIdForUser(uid);
  const profileRef = doc(db, 'storeProfiles', storeId);
  const snap = await getDocFromServer(profileRef).catch(() => getDoc(profileRef));

  if (snap.exists()) {
    const profile = snap.data() as GrabioStoreProfile;
    const role: ResolvedGrabioStore['role'] =
      profile.ownerId === uid || storeId === uid ? 'owner' : 'member';
    return { storeId, profile, role };
  }

  const profile = defaultFinanceStoreProfile(uid, email);
  await setDoc(profileRef, {
    ...profile,
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { storeId, profile, role: 'owner' };
}

export async function loadStoreProfile(
  storeId: string,
  options?: { fromServer?: boolean },
): Promise<GrabioStoreProfile | null> {
  const ref = doc(db, 'storeProfiles', storeId);
  const snap = options?.fromServer
    ? await getDocFromServer(ref).catch(() => getDoc(ref))
    : await getDoc(ref);
  return snap.exists() ? (snap.data() as GrabioStoreProfile) : null;
}
