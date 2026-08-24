#!/usr/bin/env node
/**
 * Seed first SEO content batch — inventory + accounting pillars (10 ideas).
 *
 *   node scripts/seedSeoContentBatch.cjs
 *   node scripts/seedSeoContentBatch.cjs --write
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

const BATCH = [
  {
    title: 'Multi-location inventory tracking for Lebanese retailers',
    targetKeyword: 'inventory management software Lebanon',
    pillarSlug: 'inventory',
    contentType: 'guide',
    intentStage: 'consideration',
    assignedUrl: '/blog/multi-location-inventory-lebanon',
    notes: 'Cluster: inventory pillar — link to /solutions/inventory',
  },
  {
    title: 'Weighted average costing explained for SMB wholesalers',
    targetKeyword: 'weighted average inventory costing',
    pillarSlug: 'inventory',
    contentType: 'blog',
    intentStage: 'awareness',
    assignedUrl: '/blog/weighted-average-costing-smb',
    notes: 'Cluster: inventory pillar',
  },
  {
    title: 'Purchase order workflow: from PO to stock receipt',
    targetKeyword: 'purchase order workflow software',
    pillarSlug: 'inventory',
    contentType: 'guide',
    intentStage: 'consideration',
    assignedUrl: '/blog/purchase-order-workflow',
    notes: 'Cluster: inventory pillar',
  },
  {
    title: 'Low stock alerts setup guide for Grabio stores',
    targetKeyword: 'low stock alert system',
    pillarSlug: 'inventory',
    contentType: 'guide',
    intentStage: 'decision',
    assignedUrl: '/blog/low-stock-alerts-setup',
    notes: 'Cluster: inventory pillar — CTA to signup',
  },
  {
    title: 'POS and inventory sync best practices',
    targetKeyword: 'pos inventory sync',
    pillarSlug: 'inventory',
    contentType: 'blog',
    intentStage: 'consideration',
    assignedUrl: '/blog/pos-inventory-sync',
    notes: 'Cluster: inventory + pos cross-link',
  },
  {
    title: 'Lebanese PCG chart of accounts for small business',
    targetKeyword: 'Lebanese PCG chart of accounts',
    pillarSlug: 'accounting',
    contentType: 'guide',
    intentStage: 'awareness',
    assignedUrl: '/blog/lebanese-pcg-small-business',
    notes: 'Cluster: accounting pillar — link to /solutions/accounting',
  },
  {
    title: 'General ledger vs simple bookkeeping: when to upgrade',
    targetKeyword: 'general ledger software small business',
    pillarSlug: 'accounting',
    contentType: 'blog',
    intentStage: 'consideration',
    assignedUrl: '/blog/general-ledger-vs-bookkeeping',
    notes: 'Cluster: accounting pillar',
  },
  {
    title: 'AP aging report walkthrough for finance teams',
    targetKeyword: 'accounts payable aging report',
    pillarSlug: 'accounting',
    contentType: 'guide',
    intentStage: 'decision',
    assignedUrl: '/blog/ap-aging-report-walkthrough',
    notes: 'Cluster: accounting pillar',
  },
  {
    title: 'Bank reconciliation checklist for Lebanese SMBs',
    targetKeyword: 'bank reconciliation software',
    pillarSlug: 'accounting',
    contentType: 'guide',
    intentStage: 'consideration',
    assignedUrl: '/blog/bank-reconciliation-checklist',
    notes: 'Cluster: accounting pillar',
  },
  {
    title: 'VAT filing prep for Lebanese small businesses',
    targetKeyword: 'VAT filing Lebanon small business',
    pillarSlug: 'accounting',
    contentType: 'blog',
    intentStage: 'awareness',
    assignedUrl: '/blog/vat-filing-prep-lebanon',
    notes: 'Cluster: accounting pillar',
  },
];

async function main() {
  const db = admin.firestore();
  const existing = await db.collection('seo_content').get();
  const existingTitles = new Set(existing.docs.map((d) => String(d.data().title ?? '')));

  const toInsert = BATCH.filter((row) => !existingTitles.has(row.title));
  console.log(`Found ${existing.size} existing content rows; ${toInsert.length} new to insert.`);

  if (!WRITE) {
    toInsert.forEach((row) => console.log(`  • ${row.title}`));
    console.log('\nDry run — pass --write to insert.');
    return;
  }

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const row of toInsert) {
    const ref = db.collection('seo_content').doc();
    batch.set(ref, {
      ...row,
      targetKeywordId: null,
      status: 'idea',
      publishDate: null,
      draft: null,
      checklist: {
        hasH1: false,
        hasMetaTitle: false,
        hasMetaDescription: false,
        wordCount: 0,
        internalLinksCount: 0,
        schemaType: '',
        intentStageMatch: true,
      },
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  console.log(`✅ Inserted ${toInsert.length} content ideas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
