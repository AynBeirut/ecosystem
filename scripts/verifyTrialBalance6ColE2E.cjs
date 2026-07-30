#!/usr/bin/env node
/** Smoke test: extended trial balance 6-column builder via finance vitest. */
const { execSync } = require('child_process');
const path = require('path');

const financeRoot = path.join(__dirname, '..', 'vendor', 'beirut-finance-flow-main');
const testFile = 'src/lib/ledger/trialBalanceExtended.test.ts';

try {
  execSync(`npx vitest run ${testFile}`, {
    cwd: financeRoot,
    stdio: 'inherit',
  });
  console.log('✅ verifyTrialBalance6ColE2E passed');
} catch {
  process.exit(1);
}
