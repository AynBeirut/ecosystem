#!/usr/bin/env node
/**
 * Verifies Grabio mobile Invoice Manager sections match platform FinanceModuleShell nav.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const mobileSrc = readFileSync(
  join(root, 'grabio-mobile/src/lib/invoiceApp.ts'),
  'utf8',
);
const platformSrc = readFileSync(
  join(root, 'src/pages/admin/finance/FinanceModuleShell.tsx'),
  'utf8',
);

const mobileLabels = [...mobileSrc.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
const platformLabels = [...platformSrc.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);

const platformPaths = {
  Invoices: '/admin/finance/invoices',
  Estimates: '/admin/finance/estimates',
  Receipts: '/admin/finance/receipts',
  Clients: '/admin/finance/clients',
  Products: '/admin/finance/products',
  Reports: '/admin/finance/reports',
};

const mobilePaths = {
  Invoices: '/invoice/invoices',
  Estimates: '/invoice/estimates',
  Receipts: '/invoice/receipts',
  Clients: '/invoice/clients',
  Products: '/invoice/products',
  Reports: '/invoice/reports',
};

let ok = true;

if (JSON.stringify(mobileLabels) !== JSON.stringify(platformLabels)) {
  console.error('FAIL: nav labels mismatch');
  console.error('  mobile:  ', mobileLabels);
  console.error('  platform:', platformLabels);
  ok = false;
} else {
  console.log('OK: nav labels match platform —', mobileLabels.join(', '));
}

for (const label of platformLabels) {
  const standalone = `https://grabio.space${mobilePaths[label]}`;
  const res = await fetch(standalone, { method: 'HEAD', redirect: 'follow' });
  if (res.status !== 200) {
    console.error(`FAIL: ${label} URL ${standalone} -> HTTP ${res.status}`);
    ok = false;
  } else {
    console.log(`OK: ${label} live at ${standalone}`);
  }
}

process.exit(ok ? 0 : 1);
