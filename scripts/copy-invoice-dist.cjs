#!/usr/bin/env node
/**
 * Copy Invoice Manager Vite build into root dist/invoice/ for Firebase hosting rewrite.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'suba eco sys/finance/beirut-finance-flow-main/dist');
const SRC_LEGACY = path.join(ROOT, 'the eco sys/finance/beirut-finance-flow-main/dist');
const DEST = path.join(ROOT, 'dist/invoice');

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

function sanitizeInvoiceIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(/<link rel="manifest" href="[^"]*manifest[^"]*">/g, '');
  html = html.replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '');

  const cleanupScript = `<script>(function(){try{if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});});}if('caches'in window){caches.keys().then(function(keys){keys.forEach(function(k){if(String(k).includes('workbox')||String(k).includes('grabio')||String(k).includes('invoice')){caches.delete(k);}});});}}catch(e){console.warn('[invoice-pwa-cleanup]',e);}})();</script>`;

  if (!html.includes('[invoice-pwa-cleanup]')) {
    html = html.replace('</head>', `${cleanupScript}</head>`);
  }

  fs.writeFileSync(indexPath, html);
}

let source = SRC;
if (!fs.existsSync(path.join(SRC, 'index.html'))) {
  if (fs.existsSync(path.join(SRC_LEGACY, 'index.html'))) {
    console.warn('⚠️ Using legacy invoice dist path (the eco sys/...)');
    source = SRC_LEGACY;
  } else {
    console.error('❌ Invoice Manager build missing. Run: npm run build --prefix "suba eco sys/finance/beirut-finance-flow-main"');
    process.exit(1);
  }
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
copyRecursive(source, DEST);
sanitizeInvoiceIndex(path.join(DEST, 'index.html'));

for (const staleFile of ['sw.js', 'registerSW.js', 'workbox-1d305bb8.js', 'manifest.webmanifest']) {
  const target = path.join(DEST, staleFile);
  if (fs.existsSync(target)) fs.rmSync(target, { force: true });
}

const assetlinksSrc = path.join(ROOT, 'public/.well-known/assetlinks.json');
const assetlinksDestDir = path.join(ROOT, 'dist/.well-known');
if (fs.existsSync(assetlinksSrc)) {
  fs.mkdirSync(assetlinksDestDir, { recursive: true });
  fs.copyFileSync(assetlinksSrc, path.join(assetlinksDestDir, 'assetlinks.json'));
}

console.log(`✅ Invoice Manager copied to ${DEST}`);
