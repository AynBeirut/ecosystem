import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CreditCard, Loader2, Package, Puzzle, Search, Shield, Sparkles, UserPlus, Users } from 'lucide-react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/useAuth';
import { isGrabioOpsUser } from '@/lib/grabioOpsAccess';
import { isRoadmapModule } from '@/lib/pricingDisplay';
import {
  formatGrabioAccountLabelBadge,
  formatPackageLabel,
  formatGrabioStorageLabel,
  grabioStorageUsagePercent,
  isGrabioRoleAccountStore,
  listGrabioRoleAccounts,
  roleAccountBadgeLabel,
  listGrabioPlatformClients,
  listGrabioSubAccountsByStore,
  lookupStoreByEmail,
  presetModuleIds,
  saveGrabioClientSubscription,
  subscriptionHealth,
  subscriptionStatusDetail,
  PACKAGE_PRESETS,
  MODULE_CATALOG,
  PACKAGE_PRESET_ORDER,
  tierForPreset,
  buildFreeGrantDates,
  type StartingPackageKey,
  type ModuleId,
} from '@/lib/grabioPlatformAdmin';
import type { GrabioPlatformClientRow, GrabioPlatformRoleAccountRow, GrabioPlatformSubAccountRow } from '@/types/grabioPlatformAdmin';
import { formatSubAccountRoleLabel } from '@/types/subaccount';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import VenueSetupReadinessPanel from '@/components/admin/VenueSetupReadinessPanel';
import { resolveStoreEntitlements, type StoreEntitlements } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';

const STATUS_OPTIONS = ['active', 'free', 'trial', 'grace', 'grace_period', 'expired', 'blocked'] as const;
const PLAN_OPTIONS = ['monthly', 'yearly'] as const;

function statusSelectLabel(status: string): string {
  return status;
}

function freeGrantPeriodFromPlan(plan: string): '1_month' | '1_year' {
  return plan === 'monthly' ? '1_month' : '1_year';
}

function applyFreePlanPreview(plan: string, setEnds: (value: string) => void) {
  const grant = buildFreeGrantDates(freeGrantPeriodFromPlan(plan));
  setEnds(grant.subscriptionEndsAt.slice(0, 10));
}

function isOpsFreeAccount(row: GrabioPlatformClientRow): boolean {
  const ops = row.grabioOps;
  return Boolean(
    ops?.freeGrantPeriod
    || (row.subscriptionStatus === 'active' && row.modularMonthlyUsd === 0 && ops?.billingChannel === 'manual'),
  );
}

function EditorSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-violet-100/80 bg-gradient-to-br from-white to-violet-50/40 p-3.5 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#001D4A]">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function buildEnabledModulesMap(row: GrabioPlatformClientRow): Record<string, boolean> {
  const mods: Record<string, boolean> = {};
  MODULE_CATALOG.forEach((m) => {
    mods[m.id] = false;
  });
  const saved = row.enabledModules || {};
  MODULE_CATALOG.forEach((m) => {
    if (saved[m.id]) mods[m.id] = true;
  });
  const anyOn = Object.values(mods).some(Boolean);
  if (!anyOn && row.startingPackage && row.startingPackage in PACKAGE_PRESETS) {
    presetModuleIds(row.startingPackage as StartingPackageKey).forEach((id) => {
      mods[id] = true;
    });
  }
  return mods;
}

function healthBadge(row: GrabioPlatformClientRow) {
  const { health, reason } = subscriptionStatusDetail(row);
  const badge =
    health === 'active' ? <Badge className="bg-emerald-600">Active</Badge> :
    health === 'trial' ? <Badge variant="secondary">Trial</Badge> :
    health === 'grace' ? <Badge className="bg-amber-600">Grace</Badge> :
    health === 'expired' ? <Badge variant="destructive">Expired</Badge> :
    health === 'blocked' ? <Badge variant="destructive">Blocked</Badge> :
    <Badge variant="outline">Unknown</Badge>;
  if (!reason) return badge;
  return (
    <div className="space-y-1">
      {badge}
      <p className="text-[11px] text-muted-foreground leading-tight max-w-[160px]">{reason}</p>
    </div>
  );
}

function rankGrabioSearchMatch(row: GrabioPlatformClientRow, query: string): number {
  const q = query.toLowerCase();
  const fields = [row.email, row.displayName, row.name, row.storeName, row.slug, row.storeId]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (fields.some((value) => value === q)) return 100;
  if (row.storeId.toLowerCase() === q) return 95;
  if (fields.some((value) => value.startsWith(q))) return 80;
  if (fields.some((value) => value.includes(q))) return 50;
  return 0;
}

const AdminGrabioPlatform: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isOps, setIsOps] = useState(false);
  const [rows, setRows] = useState<GrabioPlatformClientRow[]>([]);
  const [roleAccounts, setRoleAccounts] = useState<GrabioPlatformRoleAccountRow[]>([]);
  const [subAccountsByStore, setSubAccountsByStore] = useState<Record<string, GrabioPlatformSubAccountRow[]>>({});
  const [expandedStoreIds, setExpandedStoreIds] = useState<Set<string>>(() => new Set());
  const [expandedRoleIds, setExpandedRoleIds] = useState<Set<string>>(() => new Set());
  const [showTestBucket, setShowTestBucket] = useState(false);
  const [showRoleBucket, setShowRoleBucket] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'trial' | 'expired' | 'manual' | 'unknown'>('all');
  const [showTests, setShowTests] = useState(false);
  const [selected, setSelected] = useState<GrabioPlatformClientRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientEmail, setNewClientEmail] = useState('');
  const [findingClient, setFindingClient] = useState(false);

  const [packageKind, setPackageKind] = useState<'preset' | 'custom_quotation'>('preset');
  const [presetKey, setPresetKey] = useState<StartingPackageKey>('pkg_shop');
  const [customLabel, setCustomLabel] = useState('');
  const [quotedMonthlyUsd, setQuotedMonthlyUsd] = useState('');
  const [quotedYearlyUsd, setQuotedYearlyUsd] = useState('');
  const [quotationNotes, setQuotationNotes] = useState('');
  const [billingChannel, setBillingChannel] = useState<'online' | 'manual' | 'whish'>('manual');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('active');
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('yearly');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState('');
  const [opsNotes, setOpsNotes] = useState('');
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});
  const [selectedProfile, setSelectedProfile] = useState<StoreProfile | null>(null);
  const [selectedEntitlements, setSelectedEntitlements] = useState<StoreEntitlements | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storeId = selected?.storeId;
    if (!storeId) {
      setSelectedProfile(null);
      setSelectedEntitlements(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(getFirestore(), 'storeProfiles', storeId));
        if (cancelled) return;
        if (!snap.exists()) {
          setSelectedProfile(null);
          setSelectedEntitlements(null);
          return;
        }
        const profile = { id: snap.id, ...snap.data() } as StoreProfile;
        setSelectedProfile(profile);
        setSelectedEntitlements(resolveStoreEntitlements(profile));
      } catch {
        if (!cancelled) {
          setSelectedProfile(null);
          setSelectedEntitlements(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.storeId]);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ops = await isGrabioOpsUser(user.id);
      setIsOps(ops);
      if (!ops) {
        setRows([]);
        return;
      }
      setRows(await listGrabioPlatformClients(getFirestore()));
      setRoleAccounts(await listGrabioRoleAccounts(getFirestore()));
      setSubAccountsByStore(await listGrabioSubAccountsByStore(getFirestore()));
    } catch (err) {
      toast({
        title: 'Load failed',
        description: err instanceof Error ? err.message : 'Could not load Grabio clients',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [authLoading, toast, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const productionRows = useMemo(
    () => rows.filter((row) => !row.isTestClient && !isGrabioRoleAccountStore(row)),
    [rows],
  );

  const filteredRoleAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roleAccounts.filter((row) => {
      if (!q) return true;
      return [row.displayName, row.email, row.accountLabel, row.roleKind]
        .concat(row.clientStores.map((store) => store.storeName))
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [roleAccounts, search]);

  const testRows = useMemo(
    () => rows.filter((row) => row.isTestClient),
    [rows],
  );

  const rowMatchesSearch = useCallback((row: GrabioPlatformClientRow, q: string) => {
    if (!q) return true;
    const subs = subAccountsByStore[row.storeId] || [];
    const baseMatch = [row.displayName, row.name, row.email, row.storeId, row.slug, row.accountPackageLabel, row.accountLabel]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
    if (baseMatch) return true;
    return subs.some((sub) =>
      [sub.name, sub.email, sub.role].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [subAccountsByStore]);

  const rowMatchesFilter = useCallback((row: GrabioPlatformClientRow) => {
    const health = subscriptionHealth(row);
    if (filter === 'active' && health !== 'active') return false;
    if (filter === 'trial' && health !== 'trial') return false;
    if (filter === 'expired' && health !== 'expired' && health !== 'blocked') return false;
    if (filter === 'manual' && row.grabioOps?.billingChannel !== 'manual') return false;
    if (filter === 'unknown' && health !== 'unknown') return false;
    return true;
  }, [filter]);

  const filteredProduction = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productionRows.filter((row) => rowMatchesFilter(row) && rowMatchesSearch(row, q));
  }, [productionRows, rowMatchesFilter, rowMatchesSearch, search]);

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return testRows.filter((row) => rowMatchesFilter(row) && rowMatchesSearch(row, q));
  }, [rowMatchesFilter, rowMatchesSearch, search, testRows]);

  const allFiltered = useMemo(
    () => [...filteredProduction, ...filteredTests],
    [filteredProduction, filteredTests],
  );

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    setExpandedStoreIds((prev) => {
      const next = new Set(prev);
      allFiltered.forEach((row) => {
        const subs = subAccountsByStore[row.storeId] || [];
        if (subs.some((sub) => [sub.name, sub.email, sub.role].some((v) => String(v).toLowerCase().includes(q)))) {
          next.add(row.storeId);
        }
      });
      return next;
    });
  }, [allFiltered, search, subAccountsByStore]);

  const summary = useMemo(() => {
    let active = 0;
    let trial = 0;
    let expired = 0;
    let manual = 0;
    let unknown = 0;
    productionRows.forEach((row) => {
      const h = subscriptionHealth(row);
      if (h === 'active') active += 1;
      if (h === 'trial') trial += 1;
      if (h === 'expired' || h === 'blocked') expired += 1;
      if (row.grabioOps?.billingChannel === 'manual') manual += 1;
      if (h === 'unknown') unknown += 1;
    });
    return {
      total: productionRows.length,
      active,
      trial,
      expired,
      manual,
      unknown,
      hiddenTests: rows.length - productionRows.length,
    };
  }, [productionRows, rows.length]);

  const toggleStoreExpanded = (storeId: string) => {
    setExpandedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const toggleRoleExpanded = (uid: string) => {
    setExpandedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const renderStorageCell = (row: GrabioPlatformClientRow) => {
    const used = row.storageUsedMb ?? 0;
    const limit = row.storageLimitMb;
    const pct = grabioStorageUsagePercent(used, limit);
    const tone =
      pct != null && pct >= 100 ? 'text-red-600 font-medium'
      : pct != null && pct >= 90 ? 'text-amber-700 font-medium'
      : 'text-muted-foreground';
    return (
      <div className={tone}>
        <p className="text-xs tabular-nums leading-tight">{formatGrabioStorageLabel(used, limit)}</p>
        {pct != null ? <p className="text-[10px] tabular-nums">{Math.round(pct)}%</p> : null}
      </div>
    );
  };

  const renderClientRows = (row: GrabioPlatformClientRow) => {
    const subs = subAccountsByStore[row.storeId] || [];
    const expanded = expandedStoreIds.has(row.storeId);
    const accountLabelBadge = formatGrabioAccountLabelBadge(row.accountLabel);

    return (
      <React.Fragment key={row.storeId}>
        <TableRow
          className={`cursor-pointer ${selected?.storeId === row.storeId ? 'bg-muted/50' : ''}`}
          onClick={() => openEditor(row)}
        >
          <TableCell>
            <div className="flex items-start gap-2">
              {subs.length > 0 ? (
                <button
                  type="button"
                  aria-label={expanded ? 'Hide sub-accounts' : 'Show sub-accounts'}
                  className="mt-0.5 rounded p-0.5 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStoreExpanded(row.storeId);
                  }}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{row.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{row.email || 'No owner email'}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {row.isTeamDev ? <Badge className="bg-violet-700 text-[10px]">Team member</Badge> : null}
                  {row.isTestClient ? <Badge variant="outline">Auto test</Badge> : null}
                  {formatGrabioAccountLabelBadge(row.accountLabel) ? (
                    <Badge variant="secondary" className="text-[10px]">{accountLabelBadge}</Badge>
                  ) : null}
                  {subs.length > 0 ? (
                    <Badge variant="outline" className="text-[10px]">{subs.length} sub{subs.length > 1 ? 's' : ''}</Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </TableCell>
          <TableCell className="text-sm truncate">{formatPackageLabel(row)}</TableCell>
          <TableCell>{healthBadge(row)}</TableCell>
          <TableCell>{renderStorageCell(row)}</TableCell>
          <TableCell className="text-sm tabular-nums">{row.subscriptionEndsAt?.slice(0, 10) || '—'}</TableCell>
          <TableCell className="text-sm capitalize">{row.grabioOps?.billingChannel || 'online'}</TableCell>
        </TableRow>
        {expanded &&
          subs.map((sub) => (
            <TableRow
              key={sub.id}
              className="bg-slate-50/90 hover:bg-slate-100/90 cursor-pointer"
              onClick={() => openEditor(row)}
            >
              <TableCell className="pl-12">
                <p className="text-sm font-medium">{sub.name}</p>
                <p className="text-xs text-muted-foreground">{sub.email || 'No email'}</p>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {formatSubAccountRoleLabel(sub.role)} · sub-account
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">—</TableCell>
              <TableCell>
                <Badge variant={sub.status === 'active' ? 'secondary' : 'outline'} className="capitalize">
                  {sub.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">—</TableCell>
              <TableCell className="text-xs text-muted-foreground">Sub login</TableCell>
            </TableRow>
          ))}
      </React.Fragment>
    );
  };

  const renderRoleAccountRows = (row: GrabioPlatformRoleAccountRow) => {
    const expanded = expandedRoleIds.has(row.uid);
    const roleHint = row.roleKind === 'builder'
      ? 'Builds websites & digital presence'
      : 'Audits finance & accounting work';

    return (
      <React.Fragment key={row.uid}>
        <TableRow
          className="bg-sky-50/70 hover:bg-sky-50 cursor-pointer"
          onClick={() => {
            if (row.clientStores.length > 0) toggleRoleExpanded(row.uid);
          }}
        >
          <TableCell>
            <div className="flex items-start gap-2">
              {row.clientStores.length > 0 ? (
                <button
                  type="button"
                  aria-label={expanded ? 'Hide client stores' : 'Show client stores'}
                  className="mt-0.5 rounded p-0.5 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRoleExpanded(row.uid);
                  }}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{row.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                <Badge className="mt-1 bg-sky-700 text-[10px]">{roleAccountBadgeLabel(row.roleKind)}</Badge>
              </div>
            </div>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">{roleHint}</TableCell>
          <TableCell>
            <Badge variant="secondary">{row.clientStoreCount} client store{row.clientStoreCount === 1 ? '' : 's'}</Badge>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">—</TableCell>
          <TableCell className="text-xs tabular-nums">{row.builderAccessEndsAt?.slice(0, 10) || '—'}</TableCell>
          <TableCell className="text-xs capitalize">multi-store</TableCell>
        </TableRow>
        {expanded &&
          row.clientStores.map((client) => (
            <TableRow
              key={`${row.uid}-${client.storeId}`}
              className="bg-sky-50/40 hover:bg-sky-100/50 cursor-pointer"
              onClick={() => openClientStoreById(client.storeId)}
            >
              <TableCell className="pl-12">
                <p className="text-sm font-medium">{client.storeName}</p>
                <p className="text-xs text-muted-foreground">Client store · click to open</p>
              </TableCell>
              <TableCell colSpan={5} className="text-xs text-muted-foreground">
                Assigned via sub-account
              </TableCell>
            </TableRow>
          ))}
      </React.Fragment>
    );
  };

  const openEditor = (row: GrabioPlatformClientRow) => {
    setSelected(row);
    const ops = row.grabioOps;
    setPackageKind(ops?.packageKind || (row.startingPackage ? 'preset' : 'custom_quotation'));
    setPresetKey(
      (ops?.presetKey && ops.presetKey in PACKAGE_PRESETS ? ops.presetKey : row.startingPackage) as StartingPackageKey
        || 'pkg_shop',
    );
    setCustomLabel(ops?.customLabel || row.accountPackageLabel || '');
    setQuotedMonthlyUsd(ops?.quotedMonthlyUsd != null ? String(ops.quotedMonthlyUsd) : '');
    setQuotedYearlyUsd(ops?.quotedYearlyUsd != null ? String(ops.quotedYearlyUsd) : '');
    setQuotationNotes(ops?.quotationNotes || '');
    setBillingChannel(ops?.billingChannel || 'manual');
    setSubscriptionStatus(isOpsFreeAccount(row) ? 'free' : row.subscriptionStatus || 'active');
    setSubscriptionPlan(
      ops?.freeGrantPeriod === '1_month'
        ? 'monthly'
        : ops?.freeGrantPeriod === '1_year'
          ? 'yearly'
          : row.subscriptionPlan || 'yearly',
    );
    setSubscriptionEndsAt(row.subscriptionEndsAt?.slice(0, 10) || '');
    setOpsNotes(ops?.opsNotes || '');
    setEnabledModules(buildEnabledModulesMap(row));
    if (isOpsFreeAccount(row)) {
      setQuotedMonthlyUsd('0');
      setQuotedYearlyUsd('0');
      setBillingChannel('manual');
    }
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openClientStoreById = (storeId: string) => {
    const row = rows.find((entry) => entry.storeId === storeId);
    if (row) openEditor(row);
  };

  const openSearchMatch = async () => {
    const q = search.trim();
    if (!q) {
      toast({
        title: 'Type a search first',
        description: 'Enter a name, email, or store id — then Open or press Enter.',
      });
      return;
    }

    const qLower = q.toLowerCase();
    const pool = showTests ? allFiltered : filteredProduction;
    const ranked = pool
      .map((row) => ({ row, score: rankGrabioSearchMatch(row, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 1 || (ranked.length > 0 && ranked[0].score >= 100)) {
      openEditor(ranked[0].row);
      return;
    }

    if (ranked.length > 1) {
      openEditor(ranked[0].row);
      toast({
        title: 'Opened best match',
        description: `${ranked[0].row.displayName} — ${ranked.length} results. Narrow search if this is wrong.`,
      });
      return;
    }

    for (const row of pool) {
      const subs = subAccountsByStore[row.storeId] || [];
      const subHit = subs.find((sub) =>
        [sub.name, sub.email, sub.role].filter(Boolean).some((value) => String(value).toLowerCase().includes(qLower)),
      );
      if (subHit) {
        setExpandedStoreIds((prev) => new Set(prev).add(row.storeId));
        openEditor(row);
        toast({ title: 'Opened store', description: `Sub-account match: ${subHit.email || subHit.name}` });
        return;
      }
    }

    const rowByEmail = rows.find((row) => row.email?.toLowerCase() === qLower);
    if (rowByEmail) {
      openEditor(rowByEmail);
      return;
    }

    if (q.includes('@')) {
      try {
        const found = await lookupStoreByEmail(getFirestore(), q);
        if (!found) {
          toast({ title: 'Not found', description: 'No Grabio store for that email.', variant: 'destructive' });
          return;
        }
        openEditor(found);
        toast({ title: 'Found', description: found.displayName });
      } catch (err) {
        toast({
          title: 'Lookup failed',
          description: err instanceof Error ? err.message : 'Error',
          variant: 'destructive',
        });
      }
      return;
    }

    toast({ title: 'No match', description: 'No client matches this search.', variant: 'destructive' });
  };

  const applyPresetModules = (key: StartingPackageKey) => {
    const mods: Record<string, boolean> = {};
    MODULE_CATALOG.forEach((m) => {
      mods[m.id] = false;
    });
    presetModuleIds(key).forEach((id) => {
      mods[id] = true;
    });
    setEnabledModules(mods);
    setPresetKey(key);
  };

  const findAndOpenClientByEmail = async (email: string) => {
    const normalized = email.trim();
    if (!normalized) return false;
    setFindingClient(true);
    try {
      const inTable = rows.find((row) => row.email?.toLowerCase() === normalized.toLowerCase());
      if (inTable) {
        openEditor(inTable);
        return true;
      }
      const found = await lookupStoreByEmail(getFirestore(), normalized);
      if (!found) {
        toast({
          title: 'Account not found',
          description: 'Ask the client to sign up at grabio.space/signup first, then search again.',
          variant: 'destructive',
        });
        return false;
      }
      openEditor(found);
      toast({ title: 'Client ready', description: `Configure package for ${found.displayName}.` });
      return true;
    } catch (err) {
      toast({
        title: 'Lookup failed',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setFindingClient(false);
    }
  };

  const enabledModuleTotal = useMemo(
    () => Object.values(enabledModules).filter(Boolean).length,
    [enabledModules],
  );

  const liveModules = useMemo(() => MODULE_CATALOG.filter((m) => !isRoadmapModule(m)), []);
  const roadmapModules = useMemo(() => MODULE_CATALOG.filter((m) => isRoadmapModule(m)), []);

  const endsDateInPast = useMemo(() => {
    if (!subscriptionEndsAt) return false;
    const end = new Date(`${subscriptionEndsAt}T23:59:59`);
    return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
  }, [subscriptionEndsAt]);

  const saveSubscription = async (freeGrantPeriod?: '1_month' | '1_year' | null) => {
    if (!selected || !user) return;
    setSaving(true);
    try {
      const moduleIds = Object.entries(enabledModules)
        .filter(([, on]) => on)
        .map(([id]) => id as ModuleId);
      const grant = freeGrantPeriod ? buildFreeGrantDates(freeGrantPeriod) : null;
      const isFree = Boolean(freeGrantPeriod) || subscriptionStatus === 'free' || quotedMonthlyUsd === '0';
      const firestoreStatus = subscriptionStatus === 'free' ? 'active' : subscriptionStatus;
      await saveGrabioClientSubscription(getFirestore(), {
        storeId: selected.storeId,
        subscriptionStatus: firestoreStatus as typeof STATUS_OPTIONS[number],
        subscriptionTier:
          packageKind === 'preset' && presetKey
            ? tierForPreset(presetKey)
            : (selected.subscriptionTier as 'starter' | 'pro' | 'business' | undefined) || 'starter',
        subscriptionPlan: grant?.subscriptionPlan || (subscriptionPlan as typeof PLAN_OPTIONS[number]),
        subscriptionEndsAt: grant?.subscriptionEndsAt || (subscriptionEndsAt ? `${subscriptionEndsAt}T23:59:59.000Z` : new Date().toISOString()),
        packageKind,
        presetKey: packageKind === 'preset' ? presetKey : undefined,
        customLabel,
        quotedMonthlyUsd: isFree ? 0 : quotedMonthlyUsd ? Number(quotedMonthlyUsd) : undefined,
        quotedYearlyUsd: isFree ? 0 : quotedYearlyUsd ? Number(quotedYearlyUsd) : undefined,
        quotationNotes,
        billingChannel: isFree ? 'manual' : billingChannel,
        opsNotes,
        enabledModuleIds: moduleIds,
        modularMonthlyUsd: isFree ? 0 : quotedMonthlyUsd ? Number(quotedMonthlyUsd) : PACKAGE_PRESETS[presetKey]?.monthlyUsd,
        accountPackageLabel: packageKind === 'custom_quotation' ? customLabel : PACKAGE_PRESETS[presetKey]?.label,
        opsUserEmail: user.email,
        freeGrantPeriod: freeGrantPeriod || null,
      });
      toast({
        title: freeGrantPeriod ? 'Free saved' : 'Saved',
        description: `${selected.displayName} — ${freeGrantPeriod ? `until ${grant?.subscriptionEndsAt.slice(0, 10)}` : 'subscription updated'}.`,
      });
      await load();
      if (selected) {
        const refreshed = (await listGrabioPlatformClients(getFirestore())).find((r) => r.storeId === selected.storeId);
        if (refreshed) openEditor(refreshed);
      }
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Firestore rejected update',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const freeGrantPeriod =
      subscriptionStatus === 'free' ? freeGrantPeriodFromPlan(subscriptionPlan) : null;

    if (endsDateInPast && subscriptionStatus === 'active') {
      toast({
        title: 'End date is in the past',
        description: 'Set Status to free, or pick a future Ends date.',
        variant: 'destructive',
      });
      return;
    }
    await saveSubscription(freeGrantPeriod);
  };

  if (loading) {
    return (
      <AdminPageShell title="Grabio Platform" description="Loading…">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mt-10" />
      </AdminPageShell>
    );
  }

  if (!isOps) {
    return (
      <AdminPageShell title="Grabio Platform" description="Ops access only">
        <AdminPanel>
          <div className="p-6 text-sm text-muted-foreground space-y-2">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Shield className="h-4 w-4" /> Not authorized
            </p>
            <p>
              Your Firebase uid must be listed in <code className="text-xs">platformConfig/grabio.opsUids</code>.
              Ask ops to run <code className="text-xs">node scripts/ensureGrabioOpsAccess.cjs --write</code>.
            </p>
          </div>
        </AdminPanel>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="Grabio Platform"
      description="Manage Grabio SaaS clients, packages, and subscriptions — no Firebase console."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <AdminPanel className="p-4 bg-gradient-to-br from-white to-slate-50"><p className="text-xs text-muted-foreground">Clients</p><p className="text-2xl font-bold">{summary.total}</p></AdminPanel>
        <AdminPanel className="p-4 bg-gradient-to-br from-white to-emerald-50/60"><p className="text-xs text-muted-foreground">Active</p><p className="text-2xl font-bold text-emerald-600">{summary.active}</p></AdminPanel>
        <AdminPanel className="p-4 bg-gradient-to-br from-white to-amber-50/60"><p className="text-xs text-muted-foreground">Unknown / unset</p><p className="text-2xl font-bold text-amber-600">{summary.unknown}</p></AdminPanel>
        <AdminPanel className="p-4 bg-gradient-to-br from-white to-violet-50/60"><p className="text-xs text-muted-foreground">Manual billing</p><p className="text-2xl font-bold text-violet-700">{summary.manual}</p></AdminPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <AdminPanel className="min-w-0">
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px] flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 rounded-full border-violet-100"
                    placeholder="Search name, email, store id…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void openSearchMatch();
                    }}
                  />
                </div>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => void openSearchMatch()}>
                  Open
                </Button>
              </div>
              <Button type="button" className="rounded-full gap-1.5" onClick={() => setNewClientOpen(true)}>
                <UserPlus className="h-4 w-4" />
                New client
              </Button>
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="unknown">Unknown / unset</SelectItem>
                  <SelectItem value="manual">Manual billing</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                <Switch checked={showTests} onCheckedChange={setShowTests} />
                Show auto test ({summary.hiddenTests})
              </label>
            </div>

            <div className="rounded-lg border">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Store</TableHead>
                    <TableHead className="w-[18%]">Package</TableHead>
                    <TableHead className="w-[14%]">Status</TableHead>
                    <TableHead className="w-[14%]">Storage</TableHead>
                    <TableHead className="w-[12%]">Ends</TableHead>
                    <TableHead className="w-[12%]">Billing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProduction.map(renderClientRows)}
                  {filteredRoleAccounts.length > 0 ? (
                    <>
                      <TableRow
                        className="bg-sky-100/70 hover:bg-sky-100 cursor-pointer"
                        onClick={() => setShowRoleBucket((value) => !value)}
                      >
                        <TableCell colSpan={6}>
                          <div className="flex items-center gap-2 text-sm font-medium text-sky-950">
                            {showRoleBucket ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            Builder &amp; Accounting ({filteredRoleAccounts.length}) — multi-store access
                          </div>
                        </TableCell>
                      </TableRow>
                      {showRoleBucket ? filteredRoleAccounts.map(renderRoleAccountRows) : null}
                    </>
                  ) : null}
                  {!showTests && filteredTests.length > 0 ? (
                    <>
                      <TableRow
                        className="bg-amber-50/70 hover:bg-amber-50 cursor-pointer"
                        onClick={() => setShowTestBucket((value) => !value)}
                      >
                        <TableCell colSpan={6}>
                          <div className="flex items-center gap-2 text-sm font-medium text-amber-950">
                            {showTestBucket ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            Automated test accounts ({filteredTests.length}) — click to {showTestBucket ? 'hide' : 'show'}
                          </div>
                        </TableCell>
                      </TableRow>
                      {showTestBucket ? filteredTests.map(renderClientRows) : null}
                    </>
                  ) : null}
                  {showTests ? filteredTests.map(renderClientRows) : null}
                  {allFiltered.length === 0 && filteredRoleAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No clients match this search.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </AdminPanel>

        <div ref={editorRef} className="min-w-0">
        <AdminPanel>
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-[#001D4A] to-[#0A2854] p-4 text-white">
              <div className="rounded-full bg-white/15 p-2">
                <Sparkles className="h-5 w-5 text-[#F9CC3D]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold truncate">{selected ? selected.displayName : 'Client editor'}</h2>
                <p className="text-xs text-white/75 mt-0.5">
                  {selected
                    ? selected.email || 'No owner email'
                    : 'Pick a client to set package, billing, and modules.'}
                </p>
              </div>
            </div>

            {selected ? (
              <>
                <VenueSetupReadinessPanel profile={selectedProfile} entitlements={selectedEntitlements} />

                <EditorSection title="Subscription" icon={<CreditCard className="h-4 w-4 text-violet-600" />}>
                  {selected ? (
                    <p className="text-xs text-muted-foreground -mt-1 mb-1">
                      Storage: {formatGrabioStorageLabel(selected.storageUsedMb ?? 0, selected.storageLimitMb)}
                      {grabioStorageUsagePercent(selected.storageUsedMb ?? 0, selected.storageLimitMb) != null
                        ? ` (${Math.round(grabioStorageUsagePercent(selected.storageUsedMb ?? 0, selected.storageLimitMb)!)}%)`
                        : ''}
                    </p>
                  ) : null}
                  {endsDateInPast && subscriptionStatus === 'active' ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      Ends date is in the past — set Status to <strong>free</strong> or pick a future Ends date.
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={subscriptionStatus}
                        onValueChange={(value) => {
                          setSubscriptionStatus(value);
                          if (value === 'free') {
                            setBillingChannel('manual');
                            setQuotedMonthlyUsd('0');
                            setQuotedYearlyUsd('0');
                            applyFreePlanPreview(subscriptionPlan, setSubscriptionEndsAt);
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{statusSelectLabel(s)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Plan</Label>
                      <Select
                        value={subscriptionPlan}
                        onValueChange={(plan) => {
                          setSubscriptionPlan(plan);
                          if (subscriptionStatus === 'free') {
                            applyFreePlanPreview(plan, setSubscriptionEndsAt);
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLAN_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {subscriptionStatus === 'free' ? (
                        <p className="text-[11px] text-muted-foreground mt-1">monthly = 1 month · yearly = 1 year</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Ends</Label>
                      <Input type="date" value={subscriptionEndsAt} onChange={(e) => setSubscriptionEndsAt(e.target.value)} />
                    </div>
                    <div>
                      <Label>Billing channel</Label>
                      <Select value={billingChannel} onValueChange={(v) => setBillingChannel(v as typeof billingChannel)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">Online checkout</SelectItem>
                          <SelectItem value="manual">Manual invoice</SelectItem>
                          <SelectItem value="whish">Whish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </EditorSection>

                <EditorSection title="Grabio package" icon={<Package className="h-4 w-4 text-violet-600" />}>
                  <div className="flex items-center justify-between rounded-lg border bg-white/70 p-3">
                    <Label htmlFor="pkg-kind">Custom quotation</Label>
                    <Switch
                      id="pkg-kind"
                      checked={packageKind === 'custom_quotation'}
                      onCheckedChange={(on) => setPackageKind(on ? 'custom_quotation' : 'preset')}
                    />
                  </div>

                  {packageKind === 'preset' ? (
                    <div className="grid grid-cols-1 gap-2">
                      {PACKAGE_PRESET_ORDER.map((key) => {
                        const preset = PACKAGE_PRESETS[key];
                        const selectedPreset = presetKey === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => applyPresetModules(key)}
                            className={`rounded-xl border p-3 text-left transition-all ${
                              selectedPreset
                                ? 'border-[#F9CC3D] bg-gradient-to-r from-[#001D4A] to-[#0A2854] text-white shadow-md'
                                : 'border-slate-200 bg-white/90 hover:border-violet-300 hover:bg-violet-50/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-sm">{preset.label}</p>
                                <p className={`text-xs mt-0.5 ${selectedPreset ? 'text-white/75' : 'text-muted-foreground'}`}>
                                  ${preset.monthlyUsd}/mo · ${preset.yearlyUsd}/yr
                                </p>
                              </div>
                              {selectedPreset ? (
                                <Badge className="bg-[#F9CC3D] text-[#001D4A] shrink-0">Selected</Badge>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Quotation label</Label>
                        <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g. Midea Indogo — Grabio yearly" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Monthly USD</Label>
                          <Input type="number" value={quotedMonthlyUsd} onChange={(e) => setQuotedMonthlyUsd(e.target.value)} placeholder="500" />
                        </div>
                        <div>
                          <Label>Yearly USD</Label>
                          <Input type="number" value={quotedYearlyUsd} onChange={(e) => setQuotedYearlyUsd(e.target.value)} placeholder="600" />
                        </div>
                      </div>
                      <div>
                        <Label>Quotation notes</Label>
                        <Textarea value={quotationNotes} onChange={(e) => setQuotationNotes(e.target.value)} rows={2} placeholder="Meeting quote — builder not live yet" />
                      </div>
                    </>
                  )}
                </EditorSection>

                <EditorSection title={`Modules (${enabledModuleTotal} on)`} icon={<Puzzle className="h-4 w-4 text-violet-600" />}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {liveModules.map((mod) => (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                          enabledModules[mod.id]
                            ? 'border-violet-300 bg-violet-50/80'
                            : 'border-slate-200 bg-white/80 hover:border-violet-200'
                        }`}
                      >
                        <span className="text-lg leading-none mt-0.5">{mod.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{mod.name}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{mod.summary}</p>
                        </div>
                        <Switch
                          checked={Boolean(enabledModules[mod.id])}
                          onCheckedChange={(on) => setEnabledModules((prev) => ({ ...prev, [mod.id]: on }))}
                        />
                      </label>
                    ))}
                  </div>
                  {roadmapModules.length > 0 ? (
                    <details className="rounded-lg border bg-white/60 p-2 text-sm">
                      <summary className="cursor-pointer text-muted-foreground px-1">
                        Roadmap modules ({roadmapModules.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {roadmapModules.map((mod) => (
                          <label key={mod.id} className="flex items-center justify-between gap-2 px-1 py-1">
                            <span className="truncate">{mod.icon} {mod.name}</span>
                            <Switch
                              checked={Boolean(enabledModules[mod.id])}
                              onCheckedChange={(on) => setEnabledModules((prev) => ({ ...prev, [mod.id]: on }))}
                            />
                          </label>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </EditorSection>

                <EditorSection title="Ops notes" icon={<Users className="h-4 w-4 text-violet-600" />}>
                  <Textarea value={opsNotes} onChange={(e) => setOpsNotes(e.target.value)} rows={2} placeholder="Internal notes for ops team…" />
                </EditorSection>

                <Button type="button" className="w-full rounded-full" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save subscription
                </Button>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-5 text-center space-y-3">
                <Users className="h-8 w-8 mx-auto text-violet-400" />
                <p className="text-sm text-muted-foreground">
                  Search and click <strong>Open</strong>, click a table row, or use <strong>New client</strong> to configure a package.
                </p>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setNewClientOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Add client
                </Button>
              </div>
            )}
          </div>
        </AdminPanel>
        </div>
      </div>

      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-market-primary" />
              Add a Grabio client
            </DialogTitle>
            <DialogDescription>
              New clients sign up first, then you assign their package here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-950">
              <p className="font-medium">Step 1 — Client signs up</p>
              <p className="text-xs mt-1 text-amber-900/80">Send them to grabio.space/login to create their account.</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" asChild>
                <a href="https://grabio.space/login?tab=signup" target="_blank" rel="noopener noreferrer">Open signup page</a>
              </Button>
            </div>
            <div>
              <Label htmlFor="new-client-email">Step 2 — Owner email</Label>
              <Input
                id="new-client-email"
                type="email"
                placeholder="client@company.com"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void findAndOpenClientByEmail(newClientEmail).then((ok) => {
                      if (ok) {
                        setNewClientOpen(false);
                        setNewClientEmail('');
                      }
                    });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewClientOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={findingClient || !newClientEmail.trim()}
              onClick={() => {
                void findAndOpenClientByEmail(newClientEmail).then((ok) => {
                  if (ok) {
                    setNewClientOpen(false);
                    setNewClientEmail('');
                  }
                });
              }}
            >
              {findingClient ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Find & configure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminGrabioPlatform;
