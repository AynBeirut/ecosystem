import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAdminFeatureAllowed } from '@/lib/featureAccessGate';
import { hrVenueOpsNavVisibility, optionalOpsBridges, visibleVenueOpsShellSections } from '@/lib/hrVenueOpsShell';
import { canManageVenueOpsContent } from '@/lib/restaurantRolePolicy';
import {
  buildAllergenWrite,
  buildBibleWrite,
  buildBriefingWrite,
  buildFloorWrite,
  buildSpecWrite,
  buildStandardWrite,
  buildVenueRecordPatch,
  recordsForStore,
  venueOpsDashboardCounts,
} from '@/lib/venueOpsCore';
import type { StoreEntitlements } from '@/lib/entitlements';

const storeA = 'store-a';
const owner = { role: 'admin' as const, permissions: [] as string[] };
const cashier = { role: 'sub_account' as const, subAccountRole: 'cashier' as const, permissions: [] as string[] };

const entitlements: StoreEntitlements = {
  source: 'modular',
  pricingVersion: 'modular-v2',
  tier: 'pro',
  modules: { pos: true, team: true, restaurant: true },
  businessWorkflow: 'live_kitchen',
  startingPackage: 'pkg_live_kitchen',
  seatCount: 1,
  posLocationCount: 1,
  composedProductSource: 'platform',
  limits: {
    productLimit: 100,
    storageLimitMb: 5120,
    monthlyOperationsLimit: null,
    allowsComposed: false,
    allowsManufacturing: false,
    allowsCatalogImages: true,
  },
};

const profile = {
  businessWorkflow: 'live_kitchen' as const,
  venueOpsSettings: {
    restaurantFirstNavEnabled: true,
    enableBusinessFinance: false,
    enableFullInventory: false,
    enableOfficialHr: true,
    enableVenueOpsHub: true,
  },
};

const moneyKeys = ['price', 'cost', 'cogs', 'unitCost', 'salary', 'amount'];

describe('Venue Ops phase 3', () => {
  it('saves venue records with no price or stock and keeps them on one store', () => {
    const rows = [
      buildAllergenWrite({ storeId: storeA, title: 'Herb plate', allergens: 'Sesame', guestWarning: true }),
      buildBibleWrite({ storeId: storeA, title: 'Herb plate', oneLiner: 'Fresh herbs' }),
      buildSpecWrite({ storeId: storeA, title: 'House cooler', method: 'Build', par: '4' }),
      buildBriefingWrite({ storeId: storeA, period: 'daily', briefingDate: '2026-09-28', foodFocus: 'Herb plate' }),
      buildFloorWrite({ storeId: storeA, sectionName: 'Garden', tableLabel: '12', seats: '2' }),
      buildStandardWrite({ storeId: storeA, title: 'Greeting', category: 'Service' }),
    ];
    for (const row of rows) {
      expect(row.storeId).toBe(storeA);
      for (const key of moneyKeys) expect(row).not.toHaveProperty(key);
    }
    expect(rows[0].type).toBe('allergen');
    const matrix = buildAllergenWrite({
      storeId: storeA,
      title: 'Herb plate',
      presentAllergens: ['Cereals (Gluten)', 'Sesame Seeds'],
      crossContamination: true,
      reviewDate: '2026-09-28',
      reviewer: 'Chef',
    });
    expect(matrix.presentAllergens).toEqual(['Cereals (Gluten)', 'Sesame Seeds']);
    expect(matrix.crossContamination).toBe(true);
    const card = buildBibleWrite({
      storeId: storeA,
      title: 'Herb plate',
      buzzWords: 'Fresh',
      oneLiner: 'Herbs',
      meaning: 'Herb plate',
      description: 'Fresh herbs',
      ingredients: 'Herbs',
    });
    expect(card.description).toBe('Fresh herbs');
    expect(card.meaning).toBe('Herb plate');
    const batch = buildSpecWrite({
      storeId: storeA,
      title: 'Mint syrup',
      specKind: 'batch',
      vessel: 'Bottle',
      par: '4',
      batchQuantity: '2000',
      shelfLife: '3 days',
      lines: [{ item: 'Mint', quantity: '500', unit: 'g' }],
    });
    expect(batch.specKind).toBe('batch');
    expect(batch.shelfLife).toBe('3 days');
    const day = buildBriefingWrite({
      storeId: storeA,
      period: 'daily',
      briefingDate: '2026-09-28',
      foodFocus: 'Herb plate',
      beverageFocus: 'House cooler',
      buzzWords: 'Fresh',
      drinkBuzzWords: 'Cool',
      oneLiner: 'Herbs and bread',
      prompt: 'Talk about the herbs',
    });
    expect(day.oneLiner).toBe('Herbs and bread');
    expect(day.drinkBuzzWords).toBe('Cool');
    const values = buildStandardWrite({
      storeId: storeA,
      title: 'Greeting',
      kind: 'values',
      checklist: ['Welcome the guest', 'Offer water'],
    });
    expect(values.kind).toBe('values');
    expect(values.checklist).toEqual(['Welcome the guest', 'Offer water']);
    expect(rows[1].type).toBe('menu_bible');
    expect(rows[2].type).toBe('spec');
    expect(rows[3].status).toBe('draft');
    expect(buildVenueRecordPatch(rows[0])).not.toHaveProperty('storeId');
    const spec = buildSpecWrite({
      storeId: storeA,
      title: 'House cooler',
      lines: [{ item: 'Mint', quantity: '6', unit: 'sprigs' }],
    });
    expect(spec.lines).toEqual([{ item: 'Mint', quantity: '6', unit: 'sprigs' }]);
    expect(spec).not.toHaveProperty('cost');
    expect(rows[3].title).toBe('Herb plate');
    expect(rows[4].title).toBe('Garden · 12');
    expect(recordsForStore([{ storeId: storeA }, { storeId: 'store-b' }], storeA)).toHaveLength(1);
    expect(venueOpsDashboardCounts({
      knowledge: [{ kind: 'allergen' }, { kind: 'bible' }, { kind: 'spec' }],
      briefings: [{}],
      floor: [{}],
      standards: [{}],
    })).toMatchObject({ allergens: 1, bible: 1, specs: 1, briefings: 1, floor: 1, standards: 1 });
  });

  it('opens Venue Ops with finance and inventory off, and hides the HR link when HR is off', () => {
    const nav = hrVenueOpsNavVisibility({ profile, entitlements, user: owner });
    expect(nav.venueOps).toBe(true);
    expect(nav.financeLinks).toBe(false);
    expect(nav.inventoryLinks).toBe(false);
    expect(nav.hr).toBe(true);
    expect(visibleVenueOpsShellSections({ profile, entitlements, user: owner }).some((section) => section.id === 'training')).toBe(true);

    const hrOff = {
      ...profile,
      venueOpsSettings: { ...profile.venueOpsSettings, enableOfficialHr: false },
    };
    const hidden = hrVenueOpsNavVisibility({ profile: hrOff, entitlements, user: owner });
    expect(hidden.hr).toBe(false);
    expect(hidden.venueOps).toBe(true);
    expect(visibleVenueOpsShellSections({ profile: hrOff, entitlements, user: owner }).some((section) => section.id === 'training')).toBe(false);
  });

  it('hides optional bridges when finance, inventory, CRM, and reservations are off', () => {
    const bridges = optionalOpsBridges({
      profile: {
        ...profile,
        venueOpsSettings: {
          ...profile.venueOpsSettings,
          enableReservationsHub: false,
          enableCrmPipeline: false,
        },
      },
      entitlements,
      user: owner,
    });
    expect(bridges.payroll).toEqual([]);
    expect(bridges.attendancePayroll).toEqual([]);
    expect(bridges.inventory).toEqual([]);
    expect(bridges.floorContext).toEqual([]);
    expect(bridges.hrTraining.map((link) => link.to)).toEqual(['/admin/hr/training']);
  });

  it('lets a cashier open Venue Ops and blocks manager-only edits', () => {
    expect(isAdminFeatureAllowed('venue_ops', profile, entitlements, cashier)).toBe(true);
    expect(canManageVenueOpsContent(cashier)).toBe(false);
    expect(canManageVenueOpsContent(owner)).toBe(true);
  });

  it('blocks other stores in the venue collection rules', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    for (const name of ['venueKnowledgeItems', 'venueBriefings', 'venueFloorMaps', 'venueStandards']) {
      const block = rules.split(`match /${name}/`)[1]?.slice(0, 500) || '';
      expect(block, name).toContain('canReadStoreHrVenue(resource.data.storeId)');
      expect(block, name).toContain('request.resource.data.storeId == resource.data.storeId');
    }
  });
});
