#!/usr/bin/env node
/** Fix assignedPageUrl on ranked / GSC keywords. */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'serviceAccountKey.json')))),
  projectId: 'market-flow-7b074',
});

function suggestPageUrl(keyword) {
  const k = keyword.toLowerCase();
  if (k.includes('grabio')) return '/';
  if (/\bpos\b|\bpo system|point of sale|pos machine|pos register|eftpos|pos business/.test(k)) return '/solutions/pos';
  if (k.includes('inventory') || k.includes('warehouse') || k.includes('stock')) return '/solutions/inventory';
  if (k.includes('accounting') || k.includes('ledger') || k.includes('vat') || k.includes('billing') || k.includes('invoic')) {
    return '/solutions/accounting';
  }
  if (k.includes('manufacturing') || k.includes('erp') || k.includes('bom')) return '/solutions/manufacturing';
  if (k.includes('restaurant') || k.includes('kitchen') || k.includes('recipe')) return '/solutions/restaurant';
  return '/solutions/platform';
}

async function main() {
  const snap = await admin.firestore().collection('seo_keywords').get();
  let fixed = 0;
  const batch = admin.firestore().batch();
  snap.forEach((doc) => {
    const data = doc.data();
    const keyword = String(data.keyword ?? '');
    const current = String(data.assignedPageUrl ?? '');
    const suggested = suggestPageUrl(keyword);
    const hasRank = data.rankingPosition != null && Number(data.rankingPosition) > 0;
    const shouldFix =
      hasRank &&
      suggested !== current &&
      (data.keywordOrigin === 'gsc' || current === '/solutions/platform' || !current);
    if (!shouldFix) return;
    batch.update(doc.ref, { assignedPageUrl: suggested, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    fixed += 1;
  });
  if (fixed) await batch.commit();
  console.log(`Fixed ${fixed} keyword page URL(s)`);
}

main();
