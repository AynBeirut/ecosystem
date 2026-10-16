import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import OpsHubShell from '@/components/admin/OpsHubShell';
import { useAuth } from '@/context/useAuth';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import {
  activeOpsShellSection,
  hrVenueOpsNavVisibility,
  optionalOpsBridges,
  visibleVenueOpsShellSections,
} from '@/lib/hrVenueOpsShell';
import { canManageVenueOpsContent } from '@/lib/restaurantRolePolicy';
import { getActualStoreId, resolveStoreIdForAuthUser } from '@/lib/storeUtils';
import {
  useVenueOpsData,
  VenueAllergens,
  VenueBible,
  VenueBriefings,
  VenueFloor,
  VenueOverview,
  VenueSpecs,
  VenueStandards,
} from '@/pages/admin/venue/VenueOpsPanels';
import { VenueImportPreview } from '@/pages/admin/venue/VenueImportPreview';

const DATA_SECTIONS = new Set(['overview', 'allergens', 'bible', 'specs', 'briefings', 'floor', 'standards']);

const AdminVenueOpsShell: React.FC = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { profile, entitlements } = useStoreEntitlements();
  const [storeId, setStoreId] = useState<string | null>(null);
  const actor = useMemo(
    () =>
      user
        ? { role: user.role, subAccountRole: user.subAccountRole, permissions: user.permissions }
        : undefined,
    [user],
  );
  const sections = useMemo(
    () => visibleVenueOpsShellSections({ profile, entitlements, user: actor }),
    [profile, entitlements, actor],
  );
  const gateInput = { profile, entitlements, user: actor };
  const gates = hrVenueOpsNavVisibility(gateInput);
  const bridges = optionalOpsBridges(gateInput);
  const canEdit = canManageVenueOpsContent(actor);
  const active = activeOpsShellSection(pathname, sections);
  const data = useVenueOpsData(DATA_SECTIONS.has(active.id) ? storeId : null);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!user?.id) return;
      const id = getActualStoreId(user) || (await resolveStoreIdForAuthUser(user.id));
      if (!cancelled) setStoreId(id || null);
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const notes = [
    gates.financeLinks
      ? 'Finance is on. Costing is not stored on these records.'
      : 'Finance is off. These records do not use price, cost, or payroll.',
    gates.inventoryLinks
      ? 'Inventory is on. Recipe and stock links stay as a note until a later phase.'
      : 'Inventory is off. Allergens, specs, and briefings do not need stock.',
  ];
  if (data.error) notes.push(data.error);

  const shared = {
    canEdit,
    onSaved: data.reload,
  };
  const body = !storeId ? (
    <p>Opening this store…</p>
  ) : active.id === 'overview' ? (
    <VenueOverview bundle={data.bundle} />
  ) : active.id === 'allergens' ? (
    <VenueAllergens storeId={storeId} bundle={data.bundle} {...shared} />
  ) : active.id === 'bible' ? (
    <VenueBible storeId={storeId} bundle={data.bundle} {...shared} />
  ) : active.id === 'specs' ? (
    <VenueSpecs storeId={storeId} bundle={data.bundle} {...shared} bridgeLinks={bridges.inventory} />
  ) : active.id === 'briefings' ? (
    <VenueBriefings storeId={storeId} bundle={data.bundle} canEdit={canEdit} hrLinks={bridges.hrTraining} onSaved={data.reload} />
  ) : active.id === 'floor' ? (
    <VenueFloor storeId={storeId} bundle={data.bundle} canEdit={canEdit} contextLinks={bridges.floorContext} onSaved={data.reload} />
  ) : active.id === 'standards' ? (
    <VenueStandards storeId={storeId} bundle={data.bundle} canEdit={canEdit} onSaved={data.reload} />
  ) : active.id === 'training' ? (
    <p>Training assignments stay in HR.</p>
  ) : active.id === 'import' ? (
    <VenueImportPreview />
  ) : null;

  return (
    <OpsHubShell
      eyebrow="Venue operations"
      title="Venue Ops"
      description="Service knowledge, briefings, floor layout, and standards. Store profile, invoice documents, and website theme stay separate."
      sections={sections}
      active={active}
      notes={notes}
      legacyLinks={bridges.hrTraining}
    >
      {body}
    </OpsHubShell>
  );
};

export default AdminVenueOpsShell;
