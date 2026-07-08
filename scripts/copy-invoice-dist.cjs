#!/usr/bin/env node
/**
 * Copy Invoice Manager Vite build into root dist/invoice/ for Firebase hosting rewrite.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'the eco sys/finance/beirut-finance-flow-main/dist');
const DEST = path.join(ROOT, 'dist/invoice');

if (!fs.existsSync(path.join(SRC, 'index.html'))) {
  console.error('❌ Invoice Manager build missing. Run: npm run build --prefix "the eco sys/finance/beirut-finance-flow-main"');
  process.exit(1);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

function copyRecursive(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(SRC, DEST);

const assetlinksSrc = path.join(ROOT, 'public/.well-known/assetlinks.json');
const assetlinksDestDir = path.join(ROOT, 'dist/.well-known');
if (fs.existsSync(assetlinksSrc)) {
  fs.mkdirSync(assetlinksDestDir, { recursive: true });
  fs.copyFileSync(assetlinksSrc, path.join(assetlinksDestDir, 'assetlinks.json'));
}

console.log(`✅ Invoice Manager copied to ${DEST}`);
