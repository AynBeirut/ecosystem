/**
 * Generates Grabio Meta catalog CSV + functions JSON (runs without TS path aliases).
 */
const { mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const root = join(__dirname, '..');
execFileSync('npx', ['tsx', 'scripts/generateGrabioMetaCatalogFeed.ts'], {
  cwd: root,
  stdio: 'inherit',
});
