#!/usr/bin/env node
/**
 * Sync the canonical multi-currency money library from the main app into the
 * vendored Invoice Manager so both apps share ONE source of truth (decision D1).
 *
 * Canonical source: src/lib/money/*.ts
 * Copied to:
 *   - vendor/beirut-finance-flow-main/src/lib/money/*.ts (Invoice Manager web build)
 *   - functions/src/lib/money/*.ts                       (backend, separate tsc build)
 *
 * The vendor copy runs at web build time (package.json build:invoice:dist); the
 * functions copy runs at functions build time (functions prebuild). Both dests
 * are committed so standalone builds work, and resynced to prevent drift.
 * Copied files carry a DO-NOT-EDIT banner.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src/lib/money');
const DEST_DIRS = [
  path.join(ROOT, 'vendor/beirut-finance-flow-main/src/lib/money'),
  path.join(ROOT, 'functions/src/lib/money'),
];

const BANNER =
  '/* AUTO-SYNCED from src/lib/money — DO NOT EDIT HERE. Edit the canonical file in the main app. */\n';

if (!fs.existsSync(SRC_DIR)) {
  console.error(`❌ Canonical money lib missing at ${SRC_DIR}`);
  process.exit(1);
}

const files = fs
  .readdirSync(SRC_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.ts'));

for (const destDir of DEST_DIRS) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of files) {
    const body = fs.readFileSync(path.join(SRC_DIR, entry.name), 'utf8');
    fs.writeFileSync(path.join(destDir, entry.name), BANNER + body);
  }
  console.log(`✅ Synced ${files.length} money lib file(s) → ${path.relative(ROOT, destDir)}`);
}
