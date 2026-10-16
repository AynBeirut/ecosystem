#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'travel-agency/web/dist');
const DEST = path.join(ROOT, 'dist/travel');

if (!fs.existsSync(SRC)) {
  console.error('Missing travel-agency/web/dist — run: npm run build:travel:staging');
  process.exit(1);
}

function copyRecursive(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
copyRecursive(SRC, DEST);
console.log('✅ Copied travel app → dist/travel');
