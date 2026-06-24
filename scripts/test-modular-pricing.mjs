/**
 * Verify frontend/backend modular pricing parity (no Whish call).
 * Run: node scripts/test-modular-pricing.mjs
 */
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Load compiled functions pricing (after npm run build in functions/)
const functionsPricingPath = '../functions/lib/lib/modularPricing.js';

async function loadBackendPricing() {
  try {
    return await import(pathToFileURL(new URL(functionsPricingPath, import.meta.url)).href);
  } catch {
    console.error('Build functions first: cd functions && npm run build');
    process.exit(1);
  }
}

// Mirror frontend logic by eval-ing the TS constants (approximation via regex parse)
function loadFrontendModulePrices() {
  const src = readFileSync(new URL('../src/lib/modularPricing.ts', import.meta.url), 'utf8');
  const match = src.match(/export const MODULE_PRICES[^=]+=\s*(\{[\s\S]*?\n\});/);
  if (!match) throw new Error('Could not parse frontend MODULE_PRICES');
  return eval(`(${match[1]})`);
}

function loadFrontendAddonPrices() {
  const src = readFileSync(new URL('../src/lib/pricingDisplay.ts', import.meta.url), 'utf8');
  const match = src.match(/export const ADDON_PRICING[\s\S]*?= \{([\s\S]*?)\};/);
  if (!match) throw new Error('Could not parse ADDON_PRICING');
  return eval(`({${match[1]}})`);
}

function frontendCalculateCustomPrice(input, modulePrices, addonPricing) {
  const billing = input.billing;
  const seatCount = Math.max(1, input.seatCount);
  const posLocationCount = Math.max(0, input.posLocationCount);
  const extraSeats = Math.max(0, seatCount - 1);
  const seatRate = billing === 'yearly' ? 240 : 24;
  const posRate = billing === 'yearly' ? 150 : 15;
  const modulesUsd = input.moduleIds.reduce((sum, id) => sum + (modulePrices[id]?.[billing] ?? 0), 0);
  const extraSeatsUsd = extraSeats * seatRate;
  const hasPos = input.moduleIds.includes('pos');
  const extraPosUsd = (hasPos ? Math.max(0, posLocationCount - 1) : 0) * posRate;
  const addOnsUsd = (input.addOnKeys || []).reduce((sum, k) => sum + (addonPricing[k]?.[billing] ?? 0), 0);
  return modulesUsd + extraSeatsUsd + extraPosUsd + addOnsUsd;
}

const CASES = [
  {
    name: 'Shop preset modules only (monthly)',
    input: {
      moduleIds: ['invoicing', 'marketplace', 'analytics', 'payments', 'delivery', 'stock'],
      addOnKeys: [],
      seatCount: 1,
      posLocationCount: 0,
      billing: 'monthly',
    },
  },
  {
    name: 'Custom invoicing only (monthly)',
    input: {
      moduleIds: ['invoicing'],
      addOnKeys: [],
      seatCount: 1,
      posLocationCount: 0,
      billing: 'monthly',
    },
  },
  {
    name: 'Custom CRM + POS 2 locations + WhatsApp add-on (yearly)',
    input: {
      moduleIds: ['invoicing', 'marketplace', 'crm', 'pos'],
      addOnKeys: ['whatsappBusiness'],
      seatCount: 2,
      posLocationCount: 2,
      billing: 'yearly',
    },
  },
];

const backend = await loadBackendPricing();
const frontendModules = loadFrontendModulePrices();
const frontendAddons = loadFrontendAddonPrices();

let failed = 0;
console.log('\nModular pricing parity check\n' + '='.repeat(50));
for (const tc of CASES) {
  const be = backend.calculateModularAmountCents({ ...tc.input, presetLabel: 'Test' });
  const fe = frontendCalculateCustomPrice(tc.input, frontendModules, frontendAddons);
  const ok = Math.abs(be.totalUsd - fe) < 0.001;
  console.log(`\n${tc.name}`);
  console.log(`  Backend: $${be.totalUsd} (${be.amountCents} cents)`);
  console.log(`  Frontend: $${fe}`);
  console.log(`  Match: ${ok ? 'YES' : 'NO'}`);
  if (!ok) failed++;
}

console.log('\n' + '='.repeat(50));
if (failed) {
  console.error(`FAILED: ${failed} case(s)`);
  process.exit(1);
}
console.log('All cases matched.');
