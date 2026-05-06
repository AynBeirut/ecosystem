#!/usr/bin/env node

const { ESLint } = require('eslint');

const DOMAIN_FILES = {
  inventory: [
    'src/pages/admin/AdminOrders.tsx',
    'src/pages/admin/AdminFinishedGoods.tsx',
    'src/pages/admin/AdminPurchases.tsx',
    'src/lib/salesRules.ts',
    'src/types/inventory.ts',
  ],
  payments: [
    'src/pages/admin/AdminAccountStatement.tsx',
    'src/pages/admin/AdminPayments.tsx',
    'src/pages/admin/AdminSupplierCredits.tsx',
    'src/pages/admin/AdminBankReconciliation.tsx',
    'functions/src/api/checkout.ts',
    'functions/src/api/subscription.ts',
    'functions/src/api/webhooks.ts',
    'functions/src/services/whishPayment.ts',
  ],
  mobile: ['grabio-mobile/src/**/*.{ts,tsx}'],
};

function parseArgs(argv) {
  const selected = argv
    .slice(2)
    .filter((arg) => arg.startsWith('--domain='))
    .map((arg) => arg.split('=')[1]);

  return {
    domains: selected.length ? selected : Object.keys(DOMAIN_FILES),
  };
}

async function runDomain(eslint, domain) {
  const files = DOMAIN_FILES[domain] || [];
  if (files.length === 0) return { domain, errors: 0, warnings: 0, byRule: {} };

  const results = await eslint.lintFiles(files);
  const byRule = {};
  let errors = 0;
  let warnings = 0;

  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    for (const msg of result.messages) {
      const rule = msg.ruleId || 'unknown-rule';
      byRule[rule] = (byRule[rule] || 0) + 1;
    }
  }

  return { domain, errors, warnings, byRule };
}

async function main() {
  const args = parseArgs(process.argv);
  const eslint = new ESLint();

  const rows = [];
  for (const domain of args.domains) {
    rows.push(await runDomain(eslint, domain));
  }

  console.log('\nLint debt by domain:');
  for (const row of rows) {
    console.log(`- ${row.domain}: ${row.errors} errors, ${row.warnings} warnings`);
    const topRules = Object.entries(row.byRule)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [rule, count] of topRules) {
      console.log(`  ${rule}: ${count}`);
    }
  }
}

main().catch((error) => {
  console.error('Failed to produce domain lint debt report.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
