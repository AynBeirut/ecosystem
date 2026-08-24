#!/usr/bin/env node
/**
 * Finish remaining SEO ops — gaps→keywords, AEO/GEO/links seed, Tripoli/Sidon/Zahle pages.
 *   node scripts/runSeoOpsFinish.cjs --write
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
const MAPS_URL = 'https://maps.app.goo.gl/2RRAu3gfUNLZTw118';
const MAPS_PLACE_URL =
  'https://www.google.com/maps/place/VGMG%2BH8J+Grabio,+Beirut/data=!4m2!3m1!1s0x151f170026664769:0x935d324fcf443fa5!18m1!1e1';
const GBP_MANAGE_URL = 'https://business.google.com/';
const now = () => admin.firestore.FieldValue.serverTimestamp();

function normalizeKeyword(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

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

const TEMPLATE = {
  id: 'tpl-category-city',
  titlePattern: '{category} for {storeType} in {city} | Grabio',
  metaPattern:
    'Grabio {category} software for {storeType} businesses in {city}, Lebanon — inventory, POS, and accounting in one cloud platform.',
  h1Pattern: '{category} software for {storeType} in {city}',
  bodyPattern:
    '<p>{storeType} operators in {city} — including {area} — use Grabio for {category}, real-time stock, and financial reporting without juggling separate tools.</p><p>Explore <a href="/solutions/inventory">inventory</a>, <a href="/solutions/accounting">accounting</a>, and <a href="/solutions/pos">POS</a> modules.</p>',
  faqQuestionPattern: 'What is the best {category} tool for {storeType} in {city}?',
  faqAnswerPattern:
    'Grabio combines {category}, POS, and general ledger accounting for {storeType} in {city} with mobile admin apps and Lebanese PCG-ready finance modules.',
};

function buildPage(vars) {
  const title = interpolate(TEMPLATE.titlePattern, vars);
  const slug = slugify(`${vars.category}-${vars.storeType}-${vars.city}-${vars.area}`);
  const faqQ = interpolate(TEMPLATE.faqQuestionPattern, vars);
  const faqA = interpolate(TEMPLATE.faqAnswerPattern, vars);
  return {
    slug,
    templateId: TEMPLATE.id,
    templateName: 'Category stores in City',
    status: 'published',
    variables: vars,
    title,
    metaDescription: interpolate(TEMPLATE.metaPattern, vars),
    h1: interpolate(TEMPLATE.h1Pattern, vars),
    bodyHtml: interpolate(TEMPLATE.bodyPattern, vars),
    faqHtml: `<section><h2>${faqQ}</h2><p>${faqA}</p></section>`,
    faqSchema: buildFaqSchema([{ question: faqQ, answer: faqA }]),
    canonicalUrl: `https://grabio.space/pages/${slug}`,
  };
}

const CITY_BATCHES = [
  { city: 'Tripoli', areas: ['Tripoli center', 'El Mina', 'Abou Samra'] },
  { city: 'Sidon', areas: ['Saida center', 'Abra', 'Ain el Delb'] },
  { city: 'Zahle', areas: ['Zahle center', 'Bekaa strip', 'Chtaura'] },
];

const VERTICAL_COMBOS = [
  { category: 'Inventory management', storeType: 'retail store' },
  { category: 'Inventory management', storeType: 'restaurant' },
  { category: 'Inventory management', storeType: 'manufacturing shop' },
  { category: 'Accounting', storeType: 'retail store' },
  { category: 'Accounting', storeType: 'restaurant' },
  { category: 'Accounting', storeType: 'manufacturing shop' },
  { category: 'POS', storeType: 'retail store' },
  { category: 'POS', storeType: 'restaurant' },
  { category: 'POS', storeType: 'manufacturing shop' },
  { category: 'Restaurant', storeType: 'restaurant' },
];

function buildCityPages() {
  const pages = [];
  for (const { city, areas } of CITY_BATCHES) {
    for (const combo of VERTICAL_COMBOS) {
      for (const area of areas) {
        pages.push(buildPage({ city, area, ...combo }));
      }
    }
  }
  return pages;
}

function suggestPageUrl(keyword) {
  const k = keyword.toLowerCase();
  if (k.includes('inventory') || k.includes('warehouse')) return '/solutions/inventory';
  if (k.includes('accounting') || k.includes('zoho books') || k.includes('billing')) return '/solutions/accounting';
  if (k.includes('pos')) return '/solutions/pos';
  if (k.includes('manufacturing') || k.includes('erp') || k.includes('bom')) return '/solutions/manufacturing';
  if (k.includes('restaurant') || k.includes('kitchen')) return '/solutions/restaurant';
  return '/solutions/platform';
}

const AEO_FAQS = [
  {
    question: 'What is Grabio inventory management?',
    answer:
      'Grabio inventory management is a cloud module that tracks stock, purchase orders, suppliers, and costing in real time — synced with storefront, POS, and mobile admin.',
    assignedPageUrl: '/solutions/inventory',
  },
  {
    question: 'Does Grabio support Lebanese PCG accounting?',
    answer:
      'Yes. Grabio accounting supports Lebanese PCG-style chart of accounts, journal vouchers, trial balance, AP/AR aging, and bank reconciliation for SMB finance teams.',
    assignedPageUrl: '/solutions/accounting',
  },
  {
    question: 'Does Grabio POS sync inventory?',
    answer:
      'Grabio Windows POS posts sales to the same stock ledger as web orders and the admin app so in-store and online channels stay aligned.',
    assignedPageUrl: '/solutions/pos',
  },
  {
    question: 'How does Grabio handle restaurant inventory?',
    answer:
      'Grabio Restaurant Production deducts recipe ingredients at checkout so kitchen consumption is tracked without a separate manufacturing batch step.',
    assignedPageUrl: '/solutions/restaurant',
  },
  {
    question: 'Does Grabio support manufacturing and BOM?',
    answer:
      'Yes. Grabio Factory & Production includes bill of materials, production runs, batch tracking, and finished goods for light manufacturing.',
    assignedPageUrl: '/solutions/manufacturing',
  },
  {
    question: 'Is Grabio a Shopify alternative in MENA?',
    answer:
      'Grabio is a modular business platform with inventory, accounting, POS, and storefront capabilities — built for operators who need back-office software, not only a theme store.',
    assignedPageUrl: '/solutions/platform',
  },
];

const LINK_PROSPECTS = [
  { domain: 'emoove.co', type: 'partner', status: 'prospecting', notes: 'E-MOOVE partner — cross-link Grabio platform' },
  { domain: 'aynbeirut.com', type: 'partner', status: 'prospecting', notes: 'Agency site — case study / partner link' },
  { domain: 'lebanoninabox.com', type: 'directory', status: 'prospecting', notes: 'Lebanon business directory listing' },
  { domain: 'beirut.com', type: 'directory', status: 'prospecting', notes: 'Local directory — software category' },
  { domain: 'mena-startups.com', type: 'pr', status: 'prospecting', notes: 'MENA SaaS roundup pitch' },
  { domain: 'producthunt.com', type: 'pr', status: 'prospecting', notes: 'Launch / update post for Grabio platform' },
];

async function main() {
  const db = admin.firestore();
  const cityPages = buildCityPages();

  console.log(`Ops finish: ${cityPages.length} new city pages + gaps→keywords + AEO/GEO/links`);

  if (!WRITE) {
    console.log('Sample pages:');
    cityPages.slice(0, 3).forEach((p) => console.log(`  /pages/${p.slug}`));
    console.log('\nDry run — pass --write');
    return;
  }

  // 1 — Tripoli / Sidon / Zahle programmatic pages
  let batch = db.batch();
  let n = 0;
  for (const page of cityPages) {
    batch.set(
      db.collection('seo_prog_pages').doc(page.slug),
      { ...page, publishedAt: now(), createdAt: now(), updatedAt: now() },
      { merge: true },
    );
    n += 1;
    if (n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
  console.log(`✅ Published ${cityPages.length} city programmatic pages`);

  // 2 — Promote competitor gaps → keywords
  const gapsSnap = await db.collection('seo_competitor_gaps').where('status', '==', 'new').get();
  let gapsAdded = 0;
  for (const gapDoc of gapsSnap.docs) {
    const gap = gapDoc.data();
    const keyword = String(gap.keyword ?? '').trim();
    if (!keyword) continue;
    const id = normalizeKeyword(keyword).replace(/[^a-z0-9]+/g, '-').slice(0, 120);
    await db.collection('seo_keywords').doc(id).set(
      {
        keyword,
        monthlyVolume: 0,
        keywordDifficulty: 0,
        assignedPageUrl: suggestPageUrl(keyword),
        intentStage: 'consideration',
        status: 'active',
        keywordOrigin: 'competitor',
        rankingPosition: null,
        createdAt: now(),
        updatedAt: now(),
      },
      { merge: true },
    );
    await gapDoc.ref.update({ status: 'added', updatedAt: now() });
    gapsAdded += 1;
  }
  console.log(`✅ Added ${gapsAdded} competitor gaps to keyword engine`);

  // 3 — AEO FAQ bank
  for (const faq of AEO_FAQS) {
    const id = slugify(faq.question).slice(0, 120);
    await db.collection('seo_aeo_faqs').doc(id).set(
      { ...faq, schemaAdded: true, createdAt: now(), updatedAt: now() },
      { merge: true },
    );
  }
  console.log(`✅ Seeded ${AEO_FAQS.length} AEO FAQs`);

  // 4 — GEO config (GBP + Maps done by owner)
  const gbpTasks = [
    { id: 'verify', label: 'Verify business on Google Business Profile', completed: true },
    { id: 'photos', label: 'Upload storefront and team photos', completed: false },
    { id: 'services', label: 'Add core services (POS, inventory, accounting)', completed: true },
    { id: 'website', label: 'Link website https://grabio.space', completed: true },
    { id: 'contact', label: 'Phone + WhatsApp on GBP Contact tab', completed: true },
    { id: 'reviews', label: 'Respond to all Google reviews', completed: false },
    { id: 'posts', label: 'Publish weekly GBP post', completed: false },
    { id: 'hours', label: 'Confirm business hours are accurate', completed: true },
    { id: 'maps', label: 'Google Maps listing live', completed: true },
  ];

  await db.doc('seo_geo/config').set(
    {
      officialNap: {
        name: 'Grabio',
        streetAddress: 'VGMG+H8J',
        city: 'Beirut',
        region: 'Beirut Governorate',
        postalCode: '',
        country: 'LB',
        phone: '+96171110952',
        phoneDisplay: '+961 71 110 952',
        whatsappUrl: 'https://wa.me/96171110952',
        email: 'hello@grabio.space',
        url: 'https://grabio.space',
        gbpOpeningDate: '2020-11-16',
      },
      googleMapsUrl: MAPS_URL,
      googleMapsPlaceUrl: MAPS_PLACE_URL,
      gbpManageUrl: GBP_MANAGE_URL,
      gbpTasks,
      entityChecklist: {
        wikipediaMention: false,
        knowledgePanelTriggered: false,
        notes: `Google Maps: ${MAPS_URL}`,
      },
      updatedAt: now(),
    },
    { merge: true },
  );

  const citations = [
    {
      id: 'google-business-profile',
      directory: 'Google Business Profile',
      directoryUrl: MAPS_URL,
      status: 'listed',
      notes: 'Owner verified 2026-08-21',
    },
    {
      id: 'google-maps',
      directory: 'Google Maps',
      directoryUrl: MAPS_URL,
      status: 'listed',
      notes: 'Public listing live',
    },
    {
      id: 'linkedin',
      directory: 'LinkedIn Company',
      directoryUrl: 'https://www.linkedin.com/company/grabio',
      status: 'listed',
      notes: '',
    },
    {
      id: 'facebook',
      directory: 'Facebook Business Page',
      directoryUrl: 'https://facebook.com',
      status: 'not_listed',
      notes: 'Optional — add when page exists',
    },
  ];
  for (const c of citations) {
    await db.collection('seo_geo_citations').doc(c.id).set(
      { directory: c.directory, directoryUrl: c.directoryUrl, status: c.status, notes: c.notes, updatedAt: now() },
      { merge: true },
    );
  }

  const pageCounts = { beirut: 27, tripoli: 0, sidon: 0, other: 0 };
  for (const p of cityPages) {
    const city = p.variables.city.toLowerCase();
    if (city.includes('tripoli')) pageCounts.tripoli += 1;
    else if (city.includes('sidon')) pageCounts.sidon += 1;
    else if (city.includes('zahle')) pageCounts.other += 1;
  }

  for (const [cityId, label, count] of [
    ['beirut', 'Beirut', pageCounts.beirut],
    ['tripoli', 'Tripoli', pageCounts.tripoli],
    ['sidon', 'Sidon', pageCounts.sidon],
    ['other', 'Zahle / Other', pageCounts.other],
  ]) {
    await db.collection('seo_geo_cities').doc(cityId).set(
      {
        label,
        activePages: count,
        keywordCount: 0,
        estimatedTrafficShare: 0,
        updatedAt: now(),
      },
      { merge: true },
    );
  }
  console.log('✅ GEO config + citations + city page counts');

  // 5 — Link prospects
  for (const row of LINK_PROSPECTS) {
    const id = row.domain.replace(/\./g, '-');
    await db.collection('seo_link_prospects').doc(id).set(
      { ...row, drScore: null, createdAt: now(), updatedAt: now() },
      { merge: true },
    );
  }
  await db.doc('seo_links_settings/default').set({ monthlyLinkTarget: 5, updatedAt: now() }, { merge: true });
  console.log(`✅ Seeded ${LINK_PROSPECTS.length} link prospects`);

  console.log('\nDone. GSC rank sync still needs one click: /admin/seo-keywords → Sync GSC rankings');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
