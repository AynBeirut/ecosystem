#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'vendor/beirut-finance-flow-main/src/lib/ledger/ledgerHumanLabels.ts');
const DEST = path.join(ROOT, 'functions/src/lib/ledger/ledgerHumanLabels.ts');
const BANNER =
  '/* AUTO-SYNCED from vendor/beirut-finance-flow-main — DO NOT EDIT HERE. */\n';

if (!fs.existsSync(SRC)) {
  console.error(`❌ Missing ${SRC}`);
  process.exit(1);
}

fs.writeFileSync(DEST, BANNER + fs.readFileSync(SRC, 'utf8'));
console.log(`✅ Synced ledgerHumanLabels.ts → functions`);
