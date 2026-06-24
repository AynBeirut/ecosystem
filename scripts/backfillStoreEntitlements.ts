#!/usr/bin/env npx tsx
/**
 * Dry-run backfill: derive enabledModules from legacy tier/add-ons.
 *   npx tsx scripts/backfillStoreEntitlements.ts         # dry-run (default)
 *   npx tsx scripts/backfillStoreEntitlements.ts --write # staging only
 */

import admin from 'firebase-admin';

const dryRun = !process.argv.includes('--write');

type Tier = 'trial' | 'starter' | 'pro' | 'business';

function normalizeTier(raw?: string): Tier {
  if (raw === 'trial' || raw === 'starter' || raw === 'pro' || raw === 'business') return raw;
  if (raw === 'premium') return 'starter';
  return 'starter';
}

function hasAddon(data: FirebaseFirestore.DocumentData, key: string): boolean {
  const addOns = data.addOns;
  if (Array.isArray(addOns) && addOns.includes(key)) return true;
  const meta = data.addOnsMeta as Record<string, unknown> | undefined;
  if (meta?.[key] === true) return true;
  if (addOns && typeof addOns === 'object' && !Array.isArray(addOns)) {
    return (addOns as Record<string, unknown>)[key] === true;
  }
  return false;
}

function inferWorkflow(tier: Tier, data: FirebaseFirestore.DocumentData): string {
  if (data.allowsManufacturing || tier === 'pro' || tier === 'business') return 'factory';
  return 'shop';
}

function inferModules(tier: Tier, data: FirebaseFirestore.DocumentData): Record<string, boolean> {
  const modules: Record<string, boolean> = {
    invoicing: true,
    marketplace: true,
    analytics: true,
    payments: true,
    delivery: true,
    stock: true,
    dropship: true,
    services: true,
    admin_mobile: true,
  };
  if (tier === 'pro' || tier === 'business') {
    modules.factory = true;
    modules.restaurant = true;
  }
  if (hasAddon(data, 'salesCrm')) modules.crm = true;
  if (hasAddon(data, 'domainPackage')) modules.domainPackage = true;
  if (hasAddon(data, 'whatsappBusiness')) modules.whatsappBusiness = true;
  if (hasAddon(data, 'extraStorage')) modules.extraStorage = true;
  if (tier === 'business') modules.team = true;
  return modules;
}

async function main() {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const snap = await db.collection('storeProfiles').get();

  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'} | Stores: ${snap.size}`);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const tier = normalizeTier(data.subscriptionTier);
    const patch = {
      businessWorkflow: inferWorkflow(tier, data),
      enabledModules: inferModules(tier, data),
      pricingVersion: 'legacy-v1' as const,
      entitlementBackfillAt: new Date().toISOString(),
    };
    console.log(JSON.stringify({ storeId: docSnap.id, tier, ...patch }));
    if (!dryRun) {
      await docSnap.ref.set(patch, { merge: true });
    }
  }

  if (dryRun) console.log('No writes. Pass --write for staging only.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
