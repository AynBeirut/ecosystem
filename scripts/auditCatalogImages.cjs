#!/usr/bin/env node
/**
 * Audit store logos + product images across Firestore.
 * Uses the same placeholder rules as src/lib/visualFallbacks.ts (storefront icon fallbacks).
 *
 * Usage:
 *   node scripts/auditCatalogImages.cjs
 *   node scripts/auditCatalogImages.cjs --online-only
 *   node scripts/auditCatalogImages.cjs --json > reporting/data/catalog-image-audit.json
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const PLACEHOLDER_HOSTS = ['placehold.co', 'via.placeholder.com', 'dummyimage.com', 'picsum.photos'];

function isPlaceholderImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return true;
  const lower = value.toLowerCase();
  if (lower.startsWith('data:image/svg+xml')) return true;
  return PLACEHOLDER_HOSTS.some((host) => lower.includes(host));
}

function isEmojiProductImage(image) {
  return Boolean(String(image || '').startsWith('data:image/svg+xml'));
}

function classifyProductImage(image) {
  if (!String(image || '').trim()) return 'missing';
  if (isPlaceholderImageUrl(image)) return 'placeholder';
  if (isEmojiProductImage(image)) return 'emoji_tile';
  return 'real';
}

function classifyStoreLogo(logo) {
  if (!String(logo || '').trim()) return 'missing';
  if (isPlaceholderImageUrl(logo)) return 'placeholder';
  return 'real';
}

const argv = process.argv.slice(2);
const ONLINE_ONLY = argv.includes('--online-only');
const JSON_OUT = argv.includes('--json');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

(async () => {
  const [storeSnap, productSnap] = await Promise.all([
    db.collection('storeProfiles').get(),
    db.collection('products').get(),
  ]);

  const stores = storeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const products = productSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const onlineStoreIds = new Set(
    stores.filter((s) => s.status === 'online').map((s) => s.id),
  );

  const storeScope = ONLINE_ONLY
    ? stores.filter((s) => s.status === 'online')
    : stores;

  const productScope = ONLINE_ONLY
    ? products.filter((p) => onlineStoreIds.has(p.storeId))
    : products;

  const storeStats = { missing: 0, placeholder: 0, real: 0, icon_fallback: 0 };
  const storeRows = [];

  for (const store of storeScope) {
    const kind = classifyStoreLogo(store.logo);
    storeStats[kind] += 1;
    if (kind !== 'real') storeStats.icon_fallback += 1;
    storeRows.push({
      id: store.id,
      name: store.name || store.storeName || '(unnamed)',
      slug: store.slug || '',
      status: store.status || '',
      logoKind: kind,
      logo: store.logo || '',
      storefrontUses: kind === 'real' ? 'logo photo (fallback if broken)' : 'generated icon tile (free)',
    });
  }

  const productStats = { missing: 0, placeholder: 0, emoji_tile: 0, real: 0, icon_fallback: 0 };
  const productRows = [];

  for (const product of productScope) {
    const kind = classifyProductImage(product.image);
    productStats[kind] += 1;
    if (kind !== 'real') productStats.icon_fallback += 1;
    productRows.push({
      id: product.id,
      storeId: product.storeId || '',
      name: product.name || '(unnamed)',
      slug: product.slug || '',
      category: product.category || '',
      imageKind: kind,
      image: product.image || '',
      icon: product.icon || '',
      storefrontUses: kind === 'real' ? 'product photo' : 'generated emoji tile (free)',
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scope: ONLINE_ONLY ? 'online_stores_only' : 'all_stores',
    summary: {
      stores: {
        total: storeScope.length,
        ...storeStats,
        iconFallbackPct: storeScope.length
          ? Math.round((storeStats.icon_fallback / storeScope.length) * 100)
          : 0,
      },
      products: {
        total: productScope.length,
        ...productStats,
        iconFallbackPct: productScope.length
          ? Math.round((productStats.icon_fallback / productScope.length) * 100)
          : 0,
      },
      storageNote:
        'Storefront already shows free icon/emoji tiles for missing & placeholder URLs — no hosted image required.',
    },
    storesNeedingIconFallback: storeRows.filter((r) => r.logoKind !== 'real'),
    productsNeedingIconFallback: productRows.filter((r) => r.imageKind !== 'real'),
    storesWithRealLogos: storeRows.filter((r) => r.logoKind === 'real'),
    productsWithRealPhotos: productRows.filter((r) => r.imageKind === 'real'),
  };

  if (JSON_OUT) {
    const outDir = path.join(__dirname, '..', 'reporting', 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'catalog-image-audit.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report.summary, savedTo: outPath }, null, 2));
    return;
  }

  console.log('\n=== Grabio catalog image audit ===');
  console.log(`Scope: ${report.scope}`);
  console.log(`Generated: ${report.generatedAt}\n`);

  console.log('STORES');
  console.log(`  Total:        ${report.summary.stores.total}`);
  console.log(`  Real logo:    ${report.summary.stores.real}`);
  console.log(`  Placeholder:  ${report.summary.stores.placeholder}`);
  console.log(`  Missing:      ${report.summary.stores.missing}`);
  console.log(`  → Icon tile:  ${report.summary.stores.icon_fallback} (${report.summary.stores.iconFallbackPct}% — zero storage cost)\n`);

  console.log('PRODUCTS');
  console.log(`  Total:        ${report.summary.products.total}`);
  console.log(`  Real photo:   ${report.summary.products.real}`);
  console.log(`  Placeholder:  ${report.summary.products.placeholder}`);
  console.log(`  Missing:      ${report.summary.products.missing}`);
  console.log(`  Emoji tile:   ${report.summary.products.emoji_tile}`);
  console.log(`  → Icon tile:  ${report.summary.products.icon_fallback} (${report.summary.products.iconFallbackPct}% — zero storage cost)\n`);

  const topStores = report.storesNeedingIconFallback.slice(0, 15);
  if (topStores.length) {
    console.log('Sample stores on icon fallback (first 15):');
    topStores.forEach((s) => console.log(`  • ${s.name} [${s.slug || s.id}] — ${s.logoKind}`));
    if (report.storesNeedingIconFallback.length > 15) {
      console.log(`  … +${report.storesNeedingIconFallback.length - 15} more`);
    }
    console.log('');
  }

  const topProducts = report.productsNeedingIconFallback.slice(0, 15);
  if (topProducts.length) {
    console.log('Sample products on icon fallback (first 15):');
    topProducts.forEach((p) => console.log(`  • ${p.name} — ${p.imageKind}`));
    if (report.productsNeedingIconFallback.length > 15) {
      console.log(`  … +${report.productsNeedingIconFallback.length - 15} more`);
    }
    console.log('');
  }

  console.log(report.summary.storageNote);
  console.log('Run with --json to save full report to reporting/data/catalog-image-audit.json\n');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
