#!/usr/bin/env node
/**
 * Apply AI research pivots — hospitality keywords, Foodics/TheFork competitors, AEO FAQs.
 *   node scripts/runSeoVerticalResearchBoost.cjs --write
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
const db = admin.firestore();
const now = () => admin.firestore.FieldValue.serverTimestamp();

function normalizeKeyword(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function keywordDocId(keyword) {
  return normalizeKeyword(keyword).replace(/[^a-z0-9]+/g, '-').slice(0, 120);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

const RESTAURANT_KEYWORDS = [
  { keyword: 'restaurant POS Lebanon', pageUrl: '/solutions/restaurant', intent: 'decision', volume: 320, kd: 34 },
  { keyword: 'multi-currency restaurant POS Lebanon', pageUrl: '/solutions/restaurant', intent: 'decision', volume: 90, kd: 22 },
  { keyword: 'restaurant inventory software Lebanon', pageUrl: '/solutions/restaurant', intent: 'consideration', volume: 210, kd: 28 },
  { keyword: 'restaurant solution Lebanon', pageUrl: '/solutions/restaurant', intent: 'decision', volume: 170, kd: 30 },
  { keyword: 'hospitality software MENA', pageUrl: '/solutions/restaurant', intent: 'consideration', volume: 260, kd: 38 },
  { keyword: 'kitchen inventory automation', pageUrl: '/solutions/restaurant', intent: 'consideration', volume: 140, kd: 26 },
  { keyword: 'best restaurant POS with inventory tracking', pageUrl: '/blog/restaurant-pos-inventory-lebanon', intent: 'decision', volume: 480, kd: 42 },
  { keyword: 'cloud kitchen software Lebanon', pageUrl: '/solutions/restaurant', intent: 'consideration', volume: 110, kd: 24 },
  { keyword: 'Foodics alternative Lebanon', pageUrl: '/blog/modular-restaurant-platform-vs-restaurant-only-pos', intent: 'decision', volume: 70, kd: 18 },
  { keyword: 'modular restaurant platform', pageUrl: '/solutions/restaurant', intent: 'awareness', volume: 90, kd: 20 },
  { keyword: 'restaurant POS with accounting', pageUrl: '/solutions/restaurant', intent: 'decision', volume: 200, kd: 36 },
  { keyword: 'dual currency restaurant billing', pageUrl: '/solutions/pos', intent: 'consideration', volume: 60, kd: 16 },
];

const COMPETITORS = [
  { id: 'foodics', domain: 'foodics.com', label: 'Foodics' },
  { id: 'thefork', domain: 'theforkmanager.com', label: 'TheFork Manager' },
];

const COMPETITOR_GAPS = {
  foodics: [
    'restaurant POS Lebanon',
    'restaurant inventory software',
    'cloud kitchen POS',
    'F&B management software',
    'Foodics alternative',
  ],
  thefork: [
    'restaurant reservation system',
    'restaurant guest management',
    'restaurant marketing platform',
  ],
};

const AEO_FAQS = [
  {
    question: 'Is Grabio a restaurant solution or only a business platform?',
    answer:
      'Grabio is a modular business platform with a dedicated restaurant vertical at grabio.space/solutions/restaurant — POS, recipe deduction, kitchen inventory, dual currency, delivery, and accounting in one account.',
    assignedPageUrl: '/solutions/restaurant',
  },
  {
    question: 'How does Grabio compare to Foodics for restaurants in Lebanon?',
    answer:
      'Foodics focuses on F&B POS workflows. Grabio combines restaurant production and POS with inventory, general ledger accounting, manufacturing, and CRM — for operators who need hospitality plus back-office without middleware.',
    assignedPageUrl: '/blog/modular-restaurant-platform-vs-restaurant-only-pos',
  },
  {
    question: 'Does Grabio offer multi-currency restaurant POS in Lebanon?',
    answer:
      'Yes. Grabio Windows POS supports dual currency (USD/LBP) at checkout with inventory and accounting sync — see grabio.space/solutions/restaurant and /solutions/pos.',
    assignedPageUrl: '/solutions/restaurant',
  },
];

const AEO_SNIPPETS = [
  { keyword: 'restaurant solution Lebanon', snippetHolder: 'Foodics / local POS vendors', notes: 'Target: dedicated /solutions/restaurant + blog cluster' },
  { keyword: 'restaurant POS with inventory tracking', snippetHolder: 'Square / Odoo POS', notes: 'Blog: restaurant-pos-inventory-lebanon' },
  { keyword: 'modular business platform restaurant', snippetHolder: 'Grabio (emerging)', notes: 'AI correctly classifies Grabio as platform — vertical pages reinforce hospitality' },
];

async function seedKeywords() {
  let added = 0;
  for (const row of RESTAURANT_KEYWORDS) {
    const id = keywordDocId(row.keyword);
    const ref = db.collection('seo_keywords').doc(id);
    const existing = await ref.get();
    if (existing.exists) continue;
    await ref.set(
      {
        keyword: row.keyword,
        monthlyVolume: row.volume,
        keywordDifficulty: row.kd,
        assignedPageUrl: row.pageUrl,
        intentStage: row.intent,
        status: 'active',
        keywordOrigin: 'research',
        rankingPosition: null,
        createdAt: now(),
        updatedAt: now(),
      },
      { merge: true },
    );
    added += 1;
  }
  console.log(`✅ Restaurant/hospitality keywords: ${added} new`);
}

async function seedCompetitorsAndGaps() {
  for (const comp of COMPETITORS) {
    await db.collection('seo_competitors').doc(comp.id).set(
      { ...comp, createdAt: now(), updatedAt: now() },
      { merge: true },
    );
  }

  let gaps = 0;
  let promoted = 0;
  for (const [competitorId, keywords] of Object.entries(COMPETITOR_GAPS)) {
    for (const keyword of keywords) {
      const gapId = `${competitorId}-${slugify(keyword).slice(0, 80)}`;
      await db.collection('seo_competitor_gaps').doc(gapId).set(
        {
          competitorId,
          keyword,
          status: 'new',
          notes: 'AI research — hospitality vertical',
          createdAt: now(),
          updatedAt: now(),
        },
        { merge: true },
      );
      gaps += 1;

      const kwId = keywordDocId(keyword);
      const kwRef = db.collection('seo_keywords').doc(kwId);
      if (!(await kwRef.get()).exists) {
        await kwRef.set(
          {
            keyword,
            monthlyVolume: 0,
            keywordDifficulty: 0,
            assignedPageUrl: '/solutions/restaurant',
            intentStage: 'consideration',
            status: 'active',
            keywordOrigin: 'competitor',
            rankingPosition: null,
            createdAt: now(),
            updatedAt: now(),
          },
          { merge: true },
        );
        promoted += 1;
      }
      await db.collection('seo_competitor_gaps').doc(gapId).update({ status: 'added', updatedAt: now() });
    }
  }
  console.log(`✅ Competitors Foodics/TheFork + ${gaps} gaps, ${promoted} new keywords`);
}

async function seedAeo() {
  for (const faq of AEO_FAQS) {
    const id = slugify(faq.question).slice(0, 120);
    await db.collection('seo_aeo_faqs').doc(id).set(
      { ...faq, schemaAdded: true, createdAt: now(), updatedAt: now() },
      { merge: true },
    );
  }
  for (const snippet of AEO_SNIPPETS) {
    const id = slugify(snippet.keyword).slice(0, 120);
    await db.collection('seo_aeo_snippets').doc(id).set({ ...snippet, updatedAt: now() }, { merge: true });
  }
  console.log(`✅ AEO: ${AEO_FAQS.length} FAQs, ${AEO_SNIPPETS.length} snippet trackers`);
}

async function main() {
  console.log('SEO vertical research boost — restaurant / hospitality / AI positioning');
  if (!WRITE) {
    console.log(`Would seed ${RESTAURANT_KEYWORDS.length} keywords, ${COMPETITORS.length} competitors, ${AEO_FAQS.length} FAQs`);
    console.log('Dry run — pass --write');
    return;
  }
  await seedKeywords();
  await seedCompetitorsAndGaps();
  await seedAeo();
  console.log('\nDone. Deploy hosting so /solutions/restaurant + new blog posts go live.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
