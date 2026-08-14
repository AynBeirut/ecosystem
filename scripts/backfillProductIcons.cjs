#!/usr/bin/env node
/**
 * Backfill products.icon — mirrors src/lib/visualFallbacks.ts + functions/src/lib/productIcon.ts
 *
 * Usage:
 *   node scripts/backfillProductIcons.cjs --store-id=STORE_ID [--write] [--force]
 *   node scripts/importPosProductIcons.cjs --store-id=STORE_ID --file=export.json [--write]
 */
const admin = require('firebase-admin');
const path = require('path');

const POS_CATEGORY_ICONS = {
  other: '📦',
  services: '🛠️',
  accessories: '🎧',
  software: '📀',
  food: '🍽️',
  'drink---water': '💧',
};

function extractEmojiFromText(text) {
  if (!String(text || '').trim()) return undefined;
  const match = String(text).match(/\p{Extended_Pictographic}/u);
  return match?.[0];
}

function resolveCategoryIcon(category) {
  const raw = String(category || '').trim();
  if (!raw) return undefined;
  const embedded = extractEmojiFromText(raw);
  if (embedded) return embedded;
  return POS_CATEGORY_ICONS[raw.toLowerCase()];
}

const NAME_EMOJI = [
  { match: /\bwater\b|sparkling/i, emoji: '💧' },
  { match: /coffee|espresso|latte|cappuccino|mocha|americano/i, emoji: '☕' },
  { match: /muffin|cookie|cake|croissant|bread|mankouche|zaatar/i, emoji: '🧁' },
  { match: /salad|quinoa|tuna|fruit/i, emoji: '🥗' },
  { match: /milk|vegan milk/i, emoji: '🥛' },
  { match: /ice cream|sundae|dessert/i, emoji: '🍦' },
  { match: /pizza|burger|food|khardal/i, emoji: '🍽️' },
  { match: /booking|birthday|entrance|party/i, emoji: '🎉' },
  { match: /craft|wood|paint|play/i, emoji: '🎨' },
  { match: /flour|sugar|cacao|choco|beans|almond|bounty|honduras/i, emoji: '🛒' },
  { match: /onion|spice|herb/i, emoji: '🧅' },
];

const CATEGORY_EMOJI = [
  { match: /bakery|bread|cake|pastry|dessert/i, emoji: '🥐' },
  { match: /coffee|caf[eé]/i, emoji: '☕' },
  { match: /drink|juice|smoothie|water/i, emoji: '🥤' },
  { match: /salad/i, emoji: '🥗' },
  { match: /food|meal|restaurant/i, emoji: '🍽️' },
  { match: /\bservice/i, emoji: '🛠️' },
  { match: /accessor/i, emoji: '🎧' },
];

function productFallbackEmoji(icon, category, name) {
  if (String(icon || '').trim()) return String(icon).trim();
  const nameHaystack = String(name || '');
  for (const rule of NAME_EMOJI) {
    if (rule.match.test(nameHaystack)) return rule.emoji;
  }
  const categoryIcon = resolveCategoryIcon(category);
  if (categoryIcon) return categoryIcon;
  const haystack = `${category || ''} ${name || ''}`;
  for (const rule of CATEGORY_EMOJI) {
    if (rule.match.test(haystack)) return rule.emoji;
  }
  return '🛍️';
}

module.exports = { productFallbackEmoji, extractEmojiFromText };

const argv = process.argv.slice(2);
const storeArg = argv.find((a) => a.startsWith('--store-id='));
const storeId = storeArg ? storeArg.split('=')[1] : '';
const WRITE = argv.includes('--write');
const FORCE = argv.includes('--force');

if (!storeId) {
  console.error('Usage: node scripts/backfillProductIcons.cjs --store-id=STORE_ID [--write] [--force]');
  process.exit(1);
}

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

(async () => {
  const snap = await db.collection('products').where('storeId', '==', storeId).get();
  let updated = 0;
  let skipped = 0;
  const samples = [];
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const existing = String(data.icon || '').trim();
    const icon = productFallbackEmoji(undefined, data.category, data.name);

    if (existing && !FORCE) {
      skipped += 1;
      continue;
    }
    if (existing === icon && !FORCE) {
      skipped += 1;
      continue;
    }

    if (samples.length < 10) {
      samples.push({ name: data.name, was: existing || '(empty)', now: icon });
    }

    if (WRITE) {
      batch.update(doc.ref, {
        icon,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchCount += 1;
      updated += 1;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    } else {
      updated += 1;
    }
  }

  if (WRITE && batchCount > 0) await batch.commit();

  console.log(`Store ${storeId}: ${snap.size} products`);
  console.log(`Updated / would update: ${updated}, skipped: ${skipped}`);
  console.log('Samples:', samples);
  if (!WRITE) console.log('\nDry run — add --write to apply.');
  else console.log('\n✅ Icon backfill complete.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
