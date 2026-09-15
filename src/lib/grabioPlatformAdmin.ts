import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  deleteField,
  type Firestore,
} from 'firebase/firestore';
import {
  PACKAGE_PRESETS,
  modulesRecordFromList,
  type ModuleId,
  type StartingPackageKey,
} from '@/lib/moduleManifest';
import { MODULE_CATALOG } from '@/lib/pricingDisplay';
import type { GrabioOpsSubscription, GrabioPlatformClientRow, GrabioPlatformRoleAccountRow } from '@/types/grabioPlatformAdmin';
import type { StoreProfile } from '@/types/storeProfile';

export { PACKAGE_PRESETS, MODULE_CATALOG };
export type { StartingPackageKey, ModuleId };

/** Grabio team testers — always on the main ops list (never the automated-test bucket). */
export const GRABIO_TEAM_DEV_EMAILS = new Set([
  'mooveelectro@gmail.com',
  'whiteblackangle@gmail.com',
  'test@indigo.com',
  'indigo.commun@gmail.com',
]);

const INTERNAL_ACCOUNT_LABELS = new Set(['team', 'test', 'builder', 'wiped_test', 'accounting_tester', 'accounting', 'owner', 'unassigned']);

const AUTOMATED_TEST_LABELS = new Set(['wiped_test']);
const AUTOMATED_TEST_EMAILS = new Set([
  'test@indigo.com',
  'test@example.com',
  'testuser@example.com',
  'testuser12345@example.com',
]);

function looksLikeFirebaseUid(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(value) && !value.includes('@') && !value.includes(' ');
}

function nameFromEmail(email?: string): string | undefined {
  const e = (email || '').trim().toLowerCase();
  if (!e.includes('@')) return undefined;
  const local = e.split('@')[0]?.trim();
  return local || undefined;
}

export function resolveGrabioClientDisplayName(input: {
  storeId: string;
  storeName?: string;
  name?: string;
  slogan?: string;
  email?: string;
  sellerName?: string;
  accountPackageLabel?: string;
}): string {
  const candidates = [
    input.storeName,
    input.name,
    input.slogan,
    input.sellerName,
    input.accountPackageLabel,
    nameFromEmail(input.email),
  ];
  for (const raw of candidates) {
    const value = String(raw || '').trim();
    if (!value || looksLikeFirebaseUid(value)) continue;
    return value;
  }
  return nameFromEmail(input.email) || 'Unnamed store';
}

export function isGrabioRoleAccountStore(row: Pick<GrabioPlatformClientRow, 'accountLabel'>): boolean {
  const label = String(row.accountLabel || '').trim().toLowerCase();
  return label === 'builder' || label === 'accounting_tester' || label === 'accounting';
}

export function roleAccountKind(label?: string): 'builder' | 'accounting' | null {
  const normalized = String(label || '').trim().toLowerCase();
  if (normalized === 'builder') return 'builder';
  if (normalized === 'accounting_tester' || normalized === 'accounting') return 'accounting';
  return null;
}

export function roleAccountBadgeLabel(kind: 'builder' | 'accounting'): string {
  return kind === 'builder' ? 'Builder' : 'Accounting';
}

export function isGrabioTeamDevClient(row: Pick<GrabioPlatformClientRow, 'email' | 'accountLabel'>): boolean {
  const email = String(row.email || '').trim().toLowerCase();
  if (email && GRABIO_TEAM_DEV_EMAILS.has(email)) return true;
  return String(row.accountLabel || '').trim().toLowerCase() === 'team';
}

export function isGrabioPlatformTestClient(row: Pick<
  GrabioPlatformClientRow,
  'storeId' | 'email' | 'isTestAccount' | 'accountLabel' | 'storeName' | 'displayName'
>): boolean {
  if (isGrabioTeamDevClient(row)) return false;
  if (row.isTestAccount) return true;
  const label = String(row.accountLabel || '').trim().toLowerCase();
  if (label === 'test') return true;
  if (label && AUTOMATED_TEST_LABELS.has(label)) return true;
  if (row.storeId.startsWith('test-')) return true;
  const email = String(row.email || '').trim().toLowerCase();
  if (email) {
    if (AUTOMATED_TEST_EMAILS.has(email)) return true;
    if (email.endsWith('@example.com')) return true;
    if (email.includes('cloudtestlabaccounts.com')) return true;
  }
  const storeName = String(row.storeName || row.displayName || '').trim();
  if (!email && /^(POS GL Test|Live POS|Kitchen Fix|POS Order Customer)/i.test(storeName)) return true;
  return false;
}

export function formatGrabioAccountLabelBadge(label?: string): string | null {
  const raw = String(label || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (INTERNAL_ACCOUNT_LABELS.has(lower)) return null;
  return raw;
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
}

export function subscriptionStatusDetail(row: GrabioPlatformClientRow): {
  health: 'active' | 'trial' | 'grace' | 'expired' | 'blocked' | 'unknown';
  reason?: string;
} {
  const raw = String(row.subscriptionStatus || '').trim();
  const status = raw.toLowerCase();
  if (!status) {
    return { health: 'unknown', reason: 'No subscription status on profile' };
  }
  if (status === 'blocked') return { health: 'blocked' };
  if (status === 'expired') return { health: 'expired' };
  if (status === 'grace' || status === 'grace_period') return { health: 'grace' };
  if (status === 'trial') return { health: 'trial' };
  if (status === 'active') {
    const left = daysUntil(row.subscriptionEndsAt);
    if (left != null && left < 0) {
      return { health: 'expired', reason: 'End date passed but status still active' };
    }
    return { health: 'active' };
  }
  return { health: 'unknown', reason: `Unrecognized status: ${raw}` };
}

export function subscriptionHealth(row: GrabioPlatformClientRow): ReturnType<typeof subscriptionStatusDetail>['health'] {
  return subscriptionStatusDetail(row).health;
}

export async function listGrabioPlatformClients(db: Firestore): Promise<GrabioPlatformClientRow[]> {
  const [profileSnap, sellerSnap] = await Promise.all([
    getDocs(collection(db, 'storeProfiles')),
    getDocs(collection(db, 'sellers')),
  ]);

  const sellerByStoreId = new Map<string, Record<string, unknown>>();
  sellerSnap.docs.forEach((d) => {
    sellerByStoreId.set(d.id, d.data() as Record<string, unknown>);
  });

  const rows: GrabioPlatformClientRow[] = profileSnap.docs.map((d) => {
    const data = d.data() as StoreProfile & {
      storeName?: string;
      grabioOpsSubscription?: GrabioOpsSubscription;
      accountPackageLabel?: string;
      accountLabel?: string;
      isTestAccount?: boolean;
      email?: string;
    };
    const seller = sellerByStoreId.get(d.id);
    const sellerEmail = typeof seller?.email === 'string' ? seller.email : undefined;
    const sellerName = typeof seller?.name === 'string' ? seller.name : undefined;
    const profileEmail = typeof data.email === 'string' ? data.email : undefined;
    const ownerEmail = typeof (data as { ownerEmail?: string }).ownerEmail === 'string'
      ? (data as { ownerEmail?: string }).ownerEmail
      : undefined;
    const email = profileEmail || ownerEmail || sellerEmail;
    const accountLabel =
      data.accountLabel ||
      (typeof seller?.accountLabel === 'string' ? seller.accountLabel : undefined);
    const isTestAccount = data.isTestAccount === true || seller?.isTestAccount === true;
    const enabled = data.enabledModules ?? {};
    const storeName = data.storeName || undefined;
    const displayName = resolveGrabioClientDisplayName({
      storeId: d.id,
      storeName,
      name: data.name,
      slogan: data.slogan,
      email,
      sellerName,
      accountPackageLabel: data.accountPackageLabel,
    });
    const baseRow: GrabioPlatformClientRow = {
      storeId: d.id,
      displayName,
      name: data.name || storeName || displayName,
      storeName,
      email,
      slug: data.slug,
      subscriptionStatus: data.subscriptionStatus,
      subscriptionTier: data.subscriptionTier,
      subscriptionPlan: data.subscriptionPlan,
      subscriptionEndsAt: data.subscriptionEndsAt,
      startingPackage: data.startingPackage,
      accountPackageLabel: data.accountPackageLabel,
      pricingVersion: data.pricingVersion,
      modularMonthlyUsd: data.modularMonthlyUsd,
      enabledModuleCount: Object.values(enabled).filter(Boolean).length,
      enabledModules: { ...enabled },
      grabioOps: data.grabioOpsSubscription,
      isTestAccount,
      accountLabel,
      storageUsedMb: resolveGrabioStorageUsedMb(data as Record<string, unknown>),
      storageLimitMb: resolveGrabioStorageLimitMb(data as Record<string, unknown>),
    };
    const statusDetail = subscriptionStatusDetail(baseRow);
    const isTestClient = isGrabioPlatformTestClient(baseRow);
    const isTeamDev = isGrabioTeamDevClient(baseRow);
    return {
      ...baseRow,
      isTestClient,
      isTeamDev,
      statusReason: statusDetail.reason,
    };
  });

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function listGrabioSubAccountsByStore(
  db: Firestore,
): Promise<Record<string, GrabioPlatformSubAccountRow[]>> {
  const snap = await getDocs(collection(db, 'subAccounts'));
  const byStore: Record<string, GrabioPlatformSubAccountRow[]> = {};

  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const storeId = String(data.storeId || '').trim();
    if (!storeId) return;
    const row: GrabioPlatformSubAccountRow = {
      id: d.id,
      storeId,
      name: String(data.name || 'Sub-account'),
      email: String(data.email || ''),
      role: String(data.role || 'sales'),
      status: String(data.status || 'active'),
      lastLogin: typeof data.lastLogin === 'string' ? data.lastLogin : undefined,
    };
    if (!byStore[storeId]) byStore[storeId] = [];
    byStore[storeId].push(row);
  });

  Object.values(byStore).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
  return byStore;
}

/** Builder / accounting freelancers — multi-store access via subAccounts (not SaaS client stores). */
export async function listGrabioRoleAccounts(db: Firestore): Promise<GrabioPlatformRoleAccountRow[]> {
  const [sellerSnap, subSnap, profileSnap] = await Promise.all([
    getDocs(collection(db, 'sellers')),
    getDocs(collection(db, 'subAccounts')),
    getDocs(collection(db, 'storeProfiles')),
  ]);

  const profileById = new Map<string, Record<string, unknown>>();
  profileSnap.docs.forEach((d) => {
    profileById.set(d.id, d.data() as Record<string, unknown>);
  });

  const subsByEmail = new Map<string, { storeId: string; name: string }[]>();
  subSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const email = String(data.email || '').trim().toLowerCase();
    const storeId = String(data.storeId || '').trim();
    if (!email || !storeId) return;
    const profile = profileById.get(storeId);
    const storeName = String(profile?.storeName || profile?.name || storeId);
    const list = subsByEmail.get(email) || [];
    if (!list.some((entry) => entry.storeId === storeId)) {
      list.push({ storeId, storeName });
    }
    subsByEmail.set(email, list);
  });

  const rows: GrabioPlatformRoleAccountRow[] = [];
  sellerSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const kind = roleAccountKind(typeof data.accountLabel === 'string' ? data.accountLabel : undefined);
    if (!kind) return;

    const email = String(data.email || '').trim().toLowerCase();
    const clientStores = email ? (subsByEmail.get(email) || []) : [];
    const sellerName = typeof data.name === 'string' ? data.name.trim() : '';
    const displayName = sellerName || nameFromEmail(email) || String(data.accountLabel || email || d.id.slice(0, 8));

    rows.push({
      uid: d.id,
      email: email || '—',
      displayName,
      roleKind: kind,
      accountLabel: String(data.accountLabel || kind),
      clientStoreCount: clientStores.length,
      clientStores: clientStores.sort((a, b) => a.storeName.localeCompare(b.storeName)),
      builderAccessStartsAt: typeof data.builderAccessStartsAt === 'string' ? data.builderAccessStartsAt : undefined,
      builderAccessEndsAt: typeof data.builderAccessEndsAt === 'string' ? data.builderAccessEndsAt : undefined,
      hasOwnStoreProfile: profileById.has(d.id),
    });
  });

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type SaveGrabioClientSubscriptionInput = {
  storeId: string;
  subscriptionStatus: StoreProfile['subscriptionStatus'];
  subscriptionTier: StoreProfile['subscriptionTier'];
  subscriptionPlan: StoreProfile['subscriptionPlan'];
  subscriptionEndsAt: string;
  packageKind: 'preset' | 'custom_quotation';
  presetKey?: StartingPackageKey;
  customLabel?: string;
  quotedMonthlyUsd?: number;
  quotedYearlyUsd?: number;
  quotationNotes?: string;
  billingChannel: GrabioOpsSubscription['billingChannel'];
  opsNotes?: string;
  enabledModuleIds: ModuleId[];
  modularMonthlyUsd?: number;
  accountPackageLabel?: string;
  opsUserEmail?: string;
  /** Ops dashboard — $0 manual grant for 1 month or 1 year. */
  freeGrantPeriod?: '1_month' | '1_year' | null;
};

function endOfDayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

export function buildFreeGrantDates(period: '1_month' | '1_year'): {
  subscriptionPlan: 'monthly' | 'yearly';
  subscriptionStartedAt: string;
  subscriptionEndsAt: string;
  nextBillingDate: string;
} {
  const now = new Date();
  const ends = new Date(now);
  if (period === '1_month') {
    ends.setMonth(ends.getMonth() + 1);
    return {
      subscriptionPlan: 'monthly',
      subscriptionStartedAt: now.toISOString(),
      subscriptionEndsAt: endOfDayIso(ends),
      nextBillingDate: endOfDayIso(ends),
    };
  }
  ends.setFullYear(ends.getFullYear() + 1);
  return {
    subscriptionPlan: 'yearly',
    subscriptionStartedAt: now.toISOString(),
    subscriptionEndsAt: endOfDayIso(ends),
    nextBillingDate: endOfDayIso(ends),
  };
}

/** Firestore rejects undefined — omit those keys before setDoc. */
function stripUndefined<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  const out: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
    if (val === undefined) return;
    out[key] = stripUndefined(val);
  });
  return out as T;
}

export async function saveGrabioClientSubscription(
  db: Firestore,
  input: SaveGrabioClientSubscriptionInput,
): Promise<void> {
  const now = new Date().toISOString();
  const preset =
    input.packageKind === 'preset' && input.presetKey
      ? PACKAGE_PRESETS[input.presetKey]
      : undefined;

  const grabioOpsSubscription: GrabioOpsSubscription = {
    packageKind: input.packageKind,
    presetKey: input.packageKind === 'preset' ? input.presetKey : 'custom',
    ...(input.packageKind === 'custom_quotation' && input.customLabel?.trim()
      ? { customLabel: input.customLabel.trim() }
      : {}),
    ...(input.freeGrantPeriod
      ? {
          freeGrantPeriod: input.freeGrantPeriod,
          quotedMonthlyUsd: 0,
          quotedYearlyUsd: 0,
          quotationNotes: input.quotationNotes?.trim() || `Ops free grant — ${input.freeGrantPeriod.replace('_', ' ')}`,
        }
      : {}),
    ...(!input.freeGrantPeriod && input.quotedMonthlyUsd != null && Number.isFinite(input.quotedMonthlyUsd)
      ? { quotedMonthlyUsd: input.quotedMonthlyUsd }
      : {}),
    ...(!input.freeGrantPeriod && input.quotedYearlyUsd != null && Number.isFinite(input.quotedYearlyUsd)
      ? { quotedYearlyUsd: input.quotedYearlyUsd }
      : {}),
    ...(input.quotationNotes?.trim() && !input.freeGrantPeriod
      ? { quotationNotes: input.quotationNotes.trim() }
      : {}),
    ...(input.packageKind === 'custom_quotation' && !input.freeGrantPeriod ? { quotedAt: now } : {}),
    billingChannel: input.billingChannel,
    ...(input.opsNotes?.trim() ? { opsNotes: input.opsNotes.trim() } : {}),
    lastOpsUpdateAt: now,
    ...(input.opsUserEmail ? { lastOpsUpdateBy: input.opsUserEmail } : {}),
  };

  const enabledModules = modulesRecordFromList(input.enabledModuleIds);
  const isFreeGrant = Boolean(input.freeGrantPeriod) || input.modularMonthlyUsd === 0;
  const monthlyUsd = isFreeGrant
    ? 0
    : input.modularMonthlyUsd ??
      (input.packageKind === 'custom_quotation'
        ? input.quotedMonthlyUsd
        : preset?.monthlyUsd);

  const endsAtMs = new Date(input.subscriptionEndsAt).getTime();
  const reactivated = input.subscriptionStatus === 'active' && Number.isFinite(endsAtMs) && endsAtMs > Date.now();

  const patch: Record<string, unknown> = {
    subscriptionStatus: input.subscriptionStatus,
    subscriptionTier: input.subscriptionTier,
    subscriptionPlan: input.subscriptionPlan,
    subscriptionEndsAt: input.subscriptionEndsAt,
    subscriptionEndDate: input.subscriptionEndsAt,
    pricingVersion: 'modular-v2',
    enabledModules,
    grabioOpsSubscription,
    updatedAt: now,
    isTrialUser: false,
    hasUsedTrial: true,
  };

  if (input.freeGrantPeriod) {
    const grant = buildFreeGrantDates(input.freeGrantPeriod);
    patch.subscriptionPlan = grant.subscriptionPlan;
    patch.subscriptionEndsAt = grant.subscriptionEndsAt;
    patch.subscriptionEndDate = grant.subscriptionEndsAt;
    patch.subscriptionStartedAt = grant.subscriptionStartedAt;
    patch.nextBillingDate = grant.nextBillingDate;
  }

  if (reactivated) {
    patch.reminder30DaysSent = false;
    patch.reminder7DaysSent = false;
    patch.reminder3DaysSent = false;
    patch.graceStartedAt = deleteField();
    patch.graceEndsAt = deleteField();
    patch.gracePeriodStartedAt = deleteField();
    patch.paymentDueSince = deleteField();
  }

  if (input.packageKind === 'preset' && input.presetKey) {
    patch.startingPackage = input.presetKey;
    patch.businessWorkflow = preset?.workflow;
    patch.accountPackageLabel = input.accountPackageLabel?.trim() || preset?.label;
  } else {
    patch.startingPackage = 'pkg_shop';
    patch.accountPackageLabel = input.accountPackageLabel?.trim() || input.customLabel?.trim() || 'custom_quotation';
  }

  if (monthlyUsd != null && Number.isFinite(monthlyUsd)) {
    patch.modularMonthlyUsd = monthlyUsd;
  }

  await setDoc(doc(db, 'storeProfiles', input.storeId), stripUndefined(patch), { merge: true });
}

export async function lookupStoreByEmail(db: Firestore, email: string): Promise<GrabioPlatformClientRow | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const sellerSnap = await getDocs(collection(db, 'sellers'));
  const sellerDoc = sellerSnap.docs.find(
    (d) => String((d.data() as Record<string, unknown>).email || '').toLowerCase() === normalized,
  );
  if (!sellerDoc) return null;

  const profileSnap = await getDoc(doc(db, 'storeProfiles', sellerDoc.id));
  if (!profileSnap.exists()) return null;

  const clients = await listGrabioPlatformClients(db);
  return clients.find((c) => c.storeId === sellerDoc.id) ?? null;
}

export function presetModuleIds(presetKey: StartingPackageKey): ModuleId[] {
  return [...PACKAGE_PRESETS[presetKey].defaultModules];
}

/** Ops dashboard — tier is derived from package, not edited separately. */
export function tierForPreset(presetKey: StartingPackageKey): 'starter' | 'pro' | 'business' {
  if (presetKey === 'pkg_shop' || presetKey === 'pkg_live_kitchen' || presetKey === 'pkg_factory_flow') {
    return 'business';
  }
  if (presetKey === 'pkg_business_backend') return 'pro';
  return 'starter';
}

export const PACKAGE_PRESET_ORDER: StartingPackageKey[] = [
  'pkg_invoice',
  'pkg_web_presence',
  'pkg_mini_shop',
  'pkg_business_backend',
  'pkg_shop',
  'pkg_live_kitchen',
  'pkg_factory_flow',
  'pkg_ngo',
  'pkg_freelancer',
];

function parseStorageMb(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveGrabioStorageUsedMb(data: Record<string, unknown>): number {
  return (
    parseStorageMb(data.storageUsedMb)
    ?? parseStorageMb(data.storage_usage_mb)
    ?? parseStorageMb(data.currentStorageUsageMb)
    ?? 0
  );
}

export function resolveGrabioStorageLimitMb(data: Record<string, unknown>): number | null {
  return parseStorageMb(data.storageLimitMb) ?? parseStorageMb(data.storage_limit_mb);
}

export function formatGrabioStorageLabel(usedMb: number, limitMb?: number | null): string {
  const usedText = usedMb < 10 ? usedMb.toFixed(1) : String(Math.round(usedMb * 10) / 10);
  if (limitMb == null || !Number.isFinite(limitMb)) return `${usedText} MB`;
  const limitText = limitMb >= 1024 ? `${Math.round((limitMb / 1024) * 10) / 10} GB` : `${Math.round(limitMb)} MB`;
  return `${usedText} / ${limitText}`;
}

export function grabioStorageUsagePercent(usedMb: number, limitMb?: number | null): number | null {
  if (limitMb == null || !Number.isFinite(limitMb) || limitMb <= 0) return null;
  return (usedMb / limitMb) * 100;
}

export function formatPackageLabel(row: GrabioPlatformClientRow): string {
  if (row.grabioOps?.packageKind === 'custom_quotation') {
    return row.grabioOps.customLabel || row.accountPackageLabel || 'Custom quotation';
  }
  if (row.startingPackage && row.startingPackage in PACKAGE_PRESETS) {
    return PACKAGE_PRESETS[row.startingPackage as StartingPackageKey].label;
  }
  return row.accountPackageLabel || row.startingPackage || '—';
}
