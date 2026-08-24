#!/usr/bin/env node
/**
 * Phase 5 — keyword engine + competitor gaps.
 *
 *   node scripts/runSeoKeywordsPhase5.cjs
 *   node scripts/runSeoKeywordsPhase5.cjs --write
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));

const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
    projectId: 'market-flow-7b074',
  });
}

const WRITE = process.argv.includes('--write');
const now = () => admin.firestore.FieldValue.serverTimestamp();

function normalizeKeyword(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

const SOLUTION_SEEDS = [
  { slug: 'inventory', keywords: ['inventory management software', 'stock control Lebanon', 'purchase order software', 'warehouse management SMB', 'Grabio inventory'] },
  { slug: 'accounting', keywords: ['general ledger software', 'accounting software Lebanon', 'Lebanese PCG accounting', 'SMB finance software', 'Grabio accounting'] },
  { slug: 'pos', keywords: ['Windows POS software', 'point of sale Lebanon', 'retail POS sync inventory', 'Grabio POS'] },
  { slug: 'mobile-apps', keywords: ['business admin app Android', 'invoice manager mobile app', 'white label store app', 'Grabio mobile app'] },
  { slug: 'crm-psa', keywords: ['sales CRM software', 'PSA project management', 'field sales app Lebanon', 'Grabio CRM'] },
  { slug: 'restaurant', keywords: ['restaurant inventory software', 'recipe costing POS', 'cloud kitchen software', 'Grabio restaurant'] },
  { slug: 'manufacturing', keywords: ['manufacturing software SMB', 'BOM production tracking', 'factory inventory software', 'Grabio manufacturing'] },
  { slug: 'ai', keywords: ['AI business assistant', 'AI inventory software', 'Grabio AI agent'] },
  { slug: 'platform', keywords: ['Shopify alternative MENA', 'WordPress embed ecommerce', 'modular business platform', 'Grabio builder'] },
];

const EXTRA_SEEDS = [
  { keyword: 'inventory management software Lebanon', pageUrl: '/solutions/inventory', volume: 320, kd: 28, intent: 'decision' },
  { keyword: 'general ledger software SMB', pageUrl: '/solutions/accounting', volume: 880, kd: 35, intent: 'decision' },
  { keyword: 'Windows POS inventory sync', pageUrl: '/solutions/pos', volume: 540, kd: 31, intent: 'consideration' },
];

const BLOG_SEEDS = [
  { keyword: 'inventory management software Lebanon', pageUrl: '/blog/multi-location-inventory-lebanon' },
  { keyword: 'multi-location stock', pageUrl: '/blog/multi-location-inventory-lebanon' },
  { keyword: 'weighted average inventory costing', pageUrl: '/blog/weighted-average-inventory-costing' },
  { keyword: 'purchase order workflow software', pageUrl: '/blog/purchase-order-workflow-software' },
  { keyword: 'low stock alert system', pageUrl: '/blog/low-stock-alert-system' },
  { keyword: 'pos inventory sync', pageUrl: '/blog/pos-inventory-sync-windows' },
  { keyword: 'Lebanese PCG chart of accounts', pageUrl: '/blog/lebanese-pcg-chart-of-accounts' },
  { keyword: 'general ledger software small business', pageUrl: '/blog/general-ledger-software-small-business' },
  { keyword: 'accounts payable aging report', pageUrl: '/blog/accounts-payable-aging-report' },
  { keyword: 'bank reconciliation software', pageUrl: '/blog/bank-reconciliation-software-lebanon' },
    { keyword: 'VAT filing Lebanon small business', pageUrl: '/blog/vat-filing-lebanon-small-business' },
    { keyword: 'restaurant inventory software', pageUrl: '/blog/restaurant-recipe-costing-lebanon' },
    { keyword: 'recipe costing POS', pageUrl: '/blog/restaurant-recipe-costing-lebanon' },
    { keyword: 'cloud kitchen software', pageUrl: '/blog/restaurant-recipe-costing-lebanon' },
    { keyword: 'manufacturing software SMB', pageUrl: '/blog/manufacturing-bom-tracking-lebanon' },
    { keyword: 'BOM production tracking', pageUrl: '/blog/manufacturing-bom-tracking-lebanon' },
    { keyword: 'factory inventory software', pageUrl: '/blog/manufacturing-bom-tracking-lebanon' },
  ];

const COMPETITORS = [
  { id: 'odoo', domain: 'odoo.com', label: 'Odoo' },
  { id: 'zoho', domain: 'zoho.com', label: 'Zoho' },
  { id: 'erpnext', domain: 'erpnext.com', label: 'ERPNext' },
];

/** Public competitor SERP themes — gap candidates (volume/KD not measured here). */
const COMPETITOR_GAP_KEYWORDS = {
  odoo: [
    'open source erp',
    'erp software small business',
    'warehouse management system',
    'manufacturing erp software',
    'odoo inventory',
    'odoo accounting',
    'cloud erp platform',
  ],
  zoho: [
    'zoho inventory',
    'zoho books',
    'cloud accounting software',
    'inventory management cloud',
    'small business invoicing software',
  ],
  erpnext: [
    'erpnext inventory',
    'open source inventory management',
    'erp for manufacturing',
    'self hosted erp',
  ],
};

function buildKeywordRows() {
  const rows = [];
  const seen = new Set();

  const push = (row) => {
    const key = normalizeKeyword(row.keyword);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  for (const solution of SOLUTION_SEEDS) {
    for (const keyword of solution.keywords) {
      push({
        keyword,
        monthlyVolume: 0,
        keywordDifficulty: 0,
        assignedPageUrl: `/solutions/${solution.slug}`,
        intentStage: keyword.toLowerCase().includes('grabio') ? 'awareness' : 'consideration',
        status: 'active',
        keywordOrigin: 'seed',
        rankingPosition: null,
      });
    }
  }

  for (const extra of EXTRA_SEEDS) {
    push({
      keyword: extra.keyword,
      monthlyVolume: extra.volume,
      keywordDifficulty: extra.kd,
      assignedPageUrl: extra.pageUrl,
      intentStage: extra.intent,
      status: 'active',
      keywordOrigin: 'seed',
      rankingPosition: null,
    });
  }

  for (const blog of BLOG_SEEDS) {
    push({
      keyword: blog.keyword,
      monthlyVolume: 0,
      keywordDifficulty: 0,
      assignedPageUrl: blog.pageUrl,
      intentStage: 'consideration',
      status: 'active',
      keywordOrigin: 'seed',
      rankingPosition: null,
    });
  }

  return rows;
}

async function main() {
  const db = admin.firestore();
  const keywordRows = buildKeywordRows();
  let gapCount = 0;
  for (const comp of COMPETITORS) {
    gapCount += COMPETITOR_GAP_KEYWORDS[comp.id].length;
  }

  const [kwSnap, compSnap, gapSnap] = await Promise.all([
    db.collection('seo_keywords').get(),
    db.collection('seo_competitors').get(),
    db.collection('seo_competitor_gaps').get(),
  ]);

  console.log(`Current: ${kwSnap.size} keywords · ${compSnap.size} competitors · ${gapSnap.size} gaps`);
  console.log(`Phase 5 will seed ${keywordRows.length} keywords + ${COMPETITORS.length} competitors + up to ${gapCount} gaps.`);

  if (!WRITE) {
    console.log('\nSample keywords:');
    keywordRows.slice(0, 5).forEach((r) => console.log(`  ${r.keyword} → ${r.assignedPageUrl}`));
    console.log('\nDry run — pass --write to execute.');
    return;
  }

  const batch = db.batch();
  for (const row of keywordRows) {
    const id = normalizeKeyword(row.keyword).replace(/[^a-z0-9]+/g, '-').slice(0, 120);
    batch.set(
      db.collection('seo_keywords').doc(id),
      { ...row, createdAt: now(), updatedAt: now() },
      { merge: true },
    );
  }

  for (const comp of COMPETITORS) {
    batch.set(
      db.collection('seo_competitors').doc(comp.id),
      { domain: comp.domain, label: comp.label, createdAt: now(), updatedAt: now() },
      { merge: true },
    );
  }

  await batch.commit();
  console.log(`✅ Seeded ${keywordRows.length} keywords and ${COMPETITORS.length} competitors`);

  const existingKeywords = new Set(keywordRows.map((r) => normalizeKeyword(r.keyword)));
  let importedGaps = 0;
  let skippedGaps = 0;

  for (const comp of COMPETITORS) {
    for (const keyword of COMPETITOR_GAP_KEYWORDS[comp.id]) {
      const normalized = normalizeKeyword(keyword);
      if (existingKeywords.has(normalized)) {
        skippedGaps += 1;
        continue;
      }

      const gapId = `${comp.id}-${normalized.replace(/[^a-z0-9]+/g, '-')}`.slice(0, 120);
      await db.collection('seo_competitor_gaps').doc(gapId).set(
        {
          keyword: keyword.trim(),
          competitorId: comp.id,
          competitorLabel: comp.label,
          competitorDomain: comp.domain,
          status: 'new',
          createdAt: now(),
          updatedAt: now(),
        },
        { merge: true },
      );
      importedGaps += 1;
    }
  }

  console.log(`✅ Competitor gaps: ${importedGaps} new · ${skippedGaps} skipped (already in keyword engine)`);
  console.log('\nNext: /admin/seo-audit → Connect GSC → /admin/seo-keywords → Sync GSC rankings');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
