#!/usr/bin/env node
/**
 * Phase 4 — programmatic SEO: seed templates, generate local pages, publish, ping sitemap.
 *
 *   node scripts/runSeoProgrammaticPhase4.cjs
 *   node scripts/runSeoProgrammaticPhase4.cjs --write
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
const VERTICALS_ONLY = process.argv.includes('--verticals');
const SITEMAP_URL = 'https://grabio.space/sitemap.xml';

const DEFAULT_SEEDS = {
  cities: ['Beirut', 'Tripoli', 'Sidon'],
  areas: ['Hamra', 'Achrafieh', 'Verdun', 'Dbayeh'],
  categories: ['Inventory management', 'Accounting', 'POS'],
  storeTypes: ['retail store', 'restaurant'],
};

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-category-city',
    name: 'Category stores in City',
    titlePattern: '{category} for {storeType} in {city} | Grabio',
    metaPattern:
      'Grabio {category} software for {storeType} businesses in {city}, Lebanon — inventory, POS, and accounting in one cloud platform.',
    h1Pattern: '{category} software for {storeType} in {city}',
    bodyPattern:
      '<p>{storeType} operators in {city} — including {area} — use Grabio for {category}, real-time stock, and financial reporting without juggling separate tools.</p><p>Explore <a href="/solutions/inventory">inventory</a>, <a href="/solutions/accounting">accounting</a>, and <a href="/solutions/pos">POS</a> modules. Modular plans from $5/month.</p>',
    faqQuestionPattern: 'What is the best {category} tool for {storeType} in {city}?',
    faqAnswerPattern:
      'Grabio combines {category}, POS, and general ledger accounting for {storeType} in {city} with mobile admin apps and Lebanese PCG-ready finance modules.',
    enabled: true,
  },
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function interpolate(pattern, vars) {
  return pattern
    .replace(/\{city\}/g, vars.city)
    .replace(/\{area\}/g, vars.area)
    .replace(/\{category\}/g, vars.category)
    .replace(/\{storeType\}/g, vars.storeType);
}

function buildFaqSchema(faqs) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

function buildPage(template, vars) {
  const title = interpolate(template.titlePattern, vars);
  const slug = slugify(`${vars.category}-${vars.storeType}-${vars.city}-${vars.area}`);
  const faqQ = interpolate(template.faqQuestionPattern, vars);
  const faqA = interpolate(template.faqAnswerPattern, vars);
  return {
    slug,
    templateId: template.id,
    templateName: template.name,
    status: 'published',
    variables: vars,
    title,
    metaDescription: interpolate(template.metaPattern, vars),
    h1: interpolate(template.h1Pattern, vars),
    bodyHtml: interpolate(template.bodyPattern, vars),
    faqHtml: `<section><h2>${faqQ}</h2><p>${faqA}</p></section>`,
    faqSchema: buildFaqSchema([{ question: faqQ, answer: faqA }]),
    canonicalUrl: `https://grabio.space/pages/${slug}`,
  };
}

/** Beirut retail + restaurant starter (12 pages). */
function buildStarterBatch(template) {
  const city = 'Beirut';
  const areas = ['Hamra', 'Achrafieh', 'Verdun'];
  const combos = [
    { category: 'Inventory management', storeType: 'retail store' },
    { category: 'Inventory management', storeType: 'restaurant' },
    { category: 'Accounting', storeType: 'retail store' },
    { category: 'Accounting', storeType: 'restaurant' },
  ];
  const pages = [];
  for (const combo of combos) {
    for (const area of areas) {
      pages.push(buildPage(template, { city, area, ...combo }));
    }
  }
  return pages;
}

/** Restaurant + manufacturing local pages (15 pages). */
function buildVerticalBatch(template) {
  const city = 'Beirut';
  const areas = ['Hamra', 'Achrafieh', 'Verdun'];
  const combos = [
    { category: 'Inventory management', storeType: 'manufacturing shop' },
    { category: 'Accounting', storeType: 'manufacturing shop' },
    { category: 'POS', storeType: 'manufacturing shop' },
    { category: 'Restaurant', storeType: 'restaurant' },
    { category: 'POS', storeType: 'restaurant' },
  ];
  const pages = [];
  for (const combo of combos) {
    for (const area of areas) {
      pages.push(buildPage(template, { city, area, ...combo }));
    }
  }
  return pages;
}

async function pingSitemap() {
  const googleUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
  const bingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
  const results = await Promise.all([
    fetch(googleUrl).then((r) => ({ target: 'google', ok: r.ok, status: r.status })),
    fetch(bingUrl).then((r) => ({ target: 'bing', ok: r.ok, status: r.status })),
  ]);
  return results;
}

async function main() {
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const tplSnap = await db.collection('seo_prog_templates').get();
  const pageSnap = await db.collection('seo_prog_pages').where('status', '==', 'published').get();

  const starterPages = buildStarterBatch(DEFAULT_TEMPLATES[0]);
  const verticalPages = buildVerticalBatch(DEFAULT_TEMPLATES[0]);
  const pagesToPublish = VERTICALS_ONLY ? verticalPages : [...starterPages, ...verticalPages];

  console.log(`Templates: ${tplSnap.size} · Published pages: ${pageSnap.size}`);
  console.log(
    `Will publish ${pagesToPublish.length} programmatic pages` +
      (VERTICALS_ONLY ? ' (verticals only)' : ' (starter + restaurant/manufacturing)'),
  );

  if (!WRITE) {
    pagesToPublish.slice(0, 5).forEach((p) => console.log(`  /pages/${p.slug}`));
    console.log(`  … +${pagesToPublish.length - 5} more`);
    console.log('\nDry run — pass --write (optional --verticals for vertical batch only).');
    return;
  }

  for (const tpl of DEFAULT_TEMPLATES) {
    await db.collection('seo_prog_templates').doc(tpl.id).set(
      { ...tpl, createdAt: now, updatedAt: now },
      { merge: true },
    );
  }
  await db.doc('seo_prog_seeds/default').set({ ...DEFAULT_SEEDS, updatedAt: now }, { merge: true });
  await db.doc('seo_prog_settings/default').set(
    { automationMode: false, monthlyPageTarget: 20, updatedAt: now },
    { merge: true },
  );

  const batch = db.batch();
  for (const page of pagesToPublish) {
    const ref = db.collection('seo_prog_pages').doc(page.slug);
    batch.set(
      ref,
      {
        ...page,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  }
  await batch.commit();
  console.log(`✅ Published ${pagesToPublish.length} pages to seo_prog_pages`);

  const ping = await pingSitemap();
  console.log('Sitemap ping:', ping.map((r) => `${r.target}:${r.ok ? 'ok' : r.status}`).join(', '));

  starterPages.slice(0, 3).forEach((p) => console.log(`  https://grabio.space/pages/${p.slug}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
