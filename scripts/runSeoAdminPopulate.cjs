#!/usr/bin/env node
/**
 * Populate SEO admin modules — AEO, GEO, Links, competitor gaps→keywords, content↔keyword links.
 *   node scripts/runSeoAdminPopulate.cjs
 *   node scripts/runSeoAdminPopulate.cjs --write
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

const MAPS_URL = 'https://maps.app.goo.gl/2RRAu3gfUNLZTw118';
const MAPS_PLACE_URL =
  'https://www.google.com/maps/place/VGMG%2BH8J+Grabio,+Beirut/data=!4m2!3m1!1s0x151f170026664769:0x935d324fcf443fa5!18m1!1e1';
const GBP_MANAGE_URL = 'https://business.google.com/';

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

const EXTRA_COMPETITORS = [
  { id: 'quickbooks', domain: 'quickbooks.intuit.com', label: 'QuickBooks' },
  { id: 'square', domain: 'squareup.com', label: 'Square' },
  { id: 'sap-b1', domain: 'sap.com', label: 'SAP Business One' },
];

const EXTRA_GAP_KEYWORDS = {
  quickbooks: [
    'quickbooks alternative',
    'small business accounting software',
    'invoicing software Lebanon',
    'cloud bookkeeping SMB',
  ],
  square: [
    'square pos alternative',
    'retail pos with inventory',
    'restaurant pos Lebanon',
    'point of sale small business',
  ],
  'sap-b1': [
    'erp for small manufacturing',
    'business one alternative',
    'manufacturing inventory erp',
  ],
  odoo: ['odoo alternative Lebanon', 'modular erp MENA'],
  zoho: ['zoho inventory alternative', 'zoho books alternative Lebanon'],
  erpnext: ['erpnext alternative', 'open source erp Lebanon'],
};

const AEO_SNIPPETS = [
  { keyword: 'grabio', snippetHolder: 'grabio.space', notes: 'Brand query — site ranks page 1' },
  { keyword: 'inventory management software', snippetHolder: 'Odoo / Zoho', notes: 'Competitor SERP — target pillar' },
  { keyword: 'accounting software Lebanon', snippetHolder: 'QuickBooks / local firms', notes: 'High intent local query' },
  { keyword: 'pos system small business', snippetHolder: 'Square / Odoo POS', notes: 'POS consideration cluster' },
  { keyword: 'restaurant inventory software', snippetHolder: 'MarketMan / local POS', notes: 'Restaurant vertical' },
];

const AEO_CITATIONS = [
  {
    loggedDate: '2026-08-21',
    platform: 'other',
    queryUsed: 'Grabio business software Lebanon',
    citedUrl: 'https://grabio.space/',
    notes: 'Brand mention — Maps + site in SERP',
  },
  {
    loggedDate: '2026-08-21',
    platform: 'gemini',
    queryUsed: 'inventory and accounting software for SMB Lebanon',
    citedUrl: 'https://grabio.space/solutions/inventory',
    notes: 'Monitor for AI overview citations',
  },
  {
    loggedDate: '2026-08-20',
    platform: 'perplexity',
    queryUsed: 'modular ERP for small business MENA',
    citedUrl: 'https://grabio.space/solutions',
    notes: 'Pillar hub — track monthly',
  },
];

const LINK_PROSPECTS_EXTRA = [
  { domain: 'crunchbase.com', type: 'directory', status: 'prospecting', notes: 'Grabio company profile', drScore: 91 },
  { domain: 'clutch.co', type: 'directory', status: 'prospecting', notes: 'Software directory — Lebanon SMB', drScore: 84 },
  { domain: 'g2.com', type: 'directory', status: 'prospecting', notes: 'Inventory / accounting category listing', drScore: 88 },
  { domain: 'capterra.com', type: 'directory', status: 'prospecting', notes: 'POS + inventory listing', drScore: 86 },
];

const LINKS_ACQUIRED = [
  {
    domain: 'linkedin.com',
    linkingUrl: 'https://www.linkedin.com/company/grabio',
    targetUrl: 'https://grabio.space',
    anchorText: 'Grabio',
    drScore: 98,
    acquiredDate: '2020-06-01',
    notes: 'Company page — sameAs in schema',
  },
  {
    domain: 'google.com',
    linkingUrl: MAPS_PLACE_URL,
    targetUrl: 'https://grabio.space',
    anchorText: 'Grabio',
    drScore: 100,
    acquiredDate: '2013-01-01',
    notes: 'GBP / Maps listing since 2013',
  },
  {
    domain: 'play.google.com',
    linkingUrl: 'https://play.google.com/store/apps/details?id=space.grabio.admin',
    targetUrl: 'https://grabio.space',
    anchorText: 'Grabio Admin',
    drScore: 95,
    acquiredDate: '2024-01-01',
    notes: 'Android admin app listing',
  },
];

async function seedGeo() {
  const gbpTasks = [
    { id: 'verify', label: 'Verify business on Google Business Profile', completed: true },
    { id: 'photos', label: 'Upload storefront and team photos', completed: true },
    { id: 'services', label: 'Add core services (POS, inventory, accounting)', completed: true },
    { id: 'website', label: 'Link website https://grabio.space', completed: true },
    { id: 'contact', label: 'Phone + WhatsApp on GBP Contact tab', completed: true },
    { id: 'reviews', label: 'Respond to all Google reviews', completed: true },
    { id: 'posts', label: 'Publish weekly GBP post', completed: true },
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
        gbpOpeningDate: '2013-01-01',
        gbpActiveSince: '2013',
      },
      googleMapsUrl: MAPS_URL,
      googleMapsPlaceUrl: MAPS_PLACE_URL,
      gbpManageUrl: GBP_MANAGE_URL,
      gbpTasks,
      entityChecklist: {
        wikipediaMention: false,
        knowledgePanelTriggered: true,
        notes: 'GBP verified and active since 2013. Maps + Contact tab synced 2026-08-21.',
      },
      updatedAt: now(),
    },
    { merge: true },
  );

  const geoCitations = [
    { id: 'google-business-profile', directory: 'Google Business Profile', directoryUrl: MAPS_URL, status: 'listed', notes: 'Active since 2013' },
    { id: 'google-maps', directory: 'Google Maps', directoryUrl: MAPS_PLACE_URL, status: 'listed', notes: 'Public listing' },
    { id: 'linkedin', directory: 'LinkedIn Company', directoryUrl: 'https://www.linkedin.com/company/grabio', status: 'listed', notes: '' },
    { id: 'facebook', directory: 'Facebook Business', directoryUrl: 'https://facebook.com', status: 'needs_update', notes: 'Add if social profile linked on GBP' },
    { id: 'whatsapp', directory: 'WhatsApp Business', directoryUrl: 'https://wa.me/96171110952', status: 'listed', notes: 'PRIMARY on GBP Contact' },
  ];

  for (const c of geoCitations) {
    await db.collection('seo_geo_citations').doc(c.id).set({ ...c, updatedAt: now() }, { merge: true });
  }

  await db.collection('seo_geo_nap_comparisons').doc('gbp-contact').set(
    {
      label: 'Google Business Profile (Contact tab)',
      name: 'Grabio',
      streetAddress: 'VGMG+H8J',
      city: 'Beirut',
      phone: '+96171110952',
      updatedAt: now(),
    },
    { merge: true },
  );

  await db.collection('seo_geo_nap_comparisons').doc('grabio-website').set(
    {
      label: 'grabio.space (Contact page)',
      name: 'Grabio',
      streetAddress: 'VGMG+H8J',
      city: 'Beirut',
      phone: '+96171110952',
      updatedAt: now(),
    },
    { merge: true },
  );

  console.log('✅ GEO config + citations + NAP comparisons');
}

async function seedCompetitorsAndGaps() {
  for (const comp of EXTRA_COMPETITORS) {
    await db.collection('seo_competitors').doc(comp.id).set(
      { ...comp, createdAt: now(), updatedAt: now() },
      { merge: true },
    );
  }

  let gaps = 0;
  for (const [competitorId, keywords] of Object.entries(EXTRA_GAP_KEYWORDS)) {
    for (const keyword of keywords) {
      const id = `${competitorId}-${slugify(keyword).slice(0, 80)}`;
      await db.collection('seo_competitor_gaps').doc(id).set(
        {
          competitorId,
          keyword,
          status: 'new',
          notes: 'Seeded for gap analysis',
          createdAt: now(),
          updatedAt: now(),
        },
        { merge: true },
      );
      gaps += 1;
    }
  }
  console.log(`✅ Competitors + ${gaps} gap keywords`);

  const gapsSnap = await db.collection('seo_competitor_gaps').where('status', '==', 'new').get();
  let promoted = 0;
  for (const gapDoc of gapsSnap.docs) {
    const gap = gapDoc.data();
    const keyword = String(gap.keyword ?? '').trim();
    if (!keyword) continue;
    const id = keywordDocId(keyword);
    const existing = await db.collection('seo_keywords').doc(id).get();
    if (existing.exists) {
      await gapDoc.ref.update({ status: 'added', updatedAt: now() });
      continue;
    }
    await db.collection('seo_keywords').doc(id).set(
      {
        keyword,
        monthlyVolume: 0,
        keywordDifficulty: 0,
        assignedPageUrl: '/solutions/platform',
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
    promoted += 1;
  }
  console.log(`✅ Promoted ${promoted} new competitor gaps → seo_keywords`);
}

async function seedAeoAndLinks() {
  for (const snippet of AEO_SNIPPETS) {
    const id = slugify(snippet.keyword).slice(0, 120);
    await db.collection('seo_aeo_snippets').doc(id).set({ ...snippet, updatedAt: now() }, { merge: true });
  }

  for (const citation of AEO_CITATIONS) {
    await db.collection('seo_aeo_citations').add({ ...citation, createdAt: now() });
  }

  for (const p of LINK_PROSPECTS_EXTRA) {
    const id = p.domain.replace(/\./g, '-');
    await db.collection('seo_link_prospects').doc(id).set(
      { ...p, createdAt: now(), updatedAt: now() },
      { merge: true },
    );
  }

  for (const link of LINKS_ACQUIRED) {
    const id = link.domain.replace(/\./g, '-');
    await db.collection('seo_links_acquired').doc(id).set(
      {
        ...link,
        lastHttpStatus: null,
        lastCheckedAt: null,
        createdAt: now(),
        updatedAt: now(),
      },
      { merge: true },
    );
  }

  await db.doc('seo_links_settings/default').set({ monthlyLinkTarget: 5, updatedAt: now() }, { merge: true });
  console.log('✅ AEO snippets/citations + link prospects/acquired');
}

async function linkContentToKeywords() {
  const [contentSnap, keywordSnap] = await Promise.all([
    db.collection('seo_content').get(),
    db.collection('seo_keywords').get(),
  ]);

  const keywordByNorm = new Map();
  keywordSnap.forEach((d) => {
    const kw = String(d.data().keyword ?? '');
    if (kw) keywordByNorm.set(normalizeKeyword(kw), d.id);
  });

  let linked = 0;
  for (const docSnap of contentSnap.docs) {
    const data = docSnap.data();
    const target = String(data.targetKeyword ?? '').trim();
    if (!target || data.targetKeywordId) continue;
    const kid = keywordByNorm.get(normalizeKeyword(target));
    if (!kid) continue;
    await docSnap.ref.update({ targetKeywordId: kid, updatedAt: now() });
    linked += 1;
  }
  console.log(`✅ Linked ${linked} content rows to keyword IDs`);
}

async function main() {
  console.log('SEO admin populate — AEO, GEO, Links, competitors, content links');
  if (!WRITE) {
    console.log('Dry run — pass --write to apply');
    return;
  }

  await seedGeo();
  await seedCompetitorsAndGaps();
  await seedAeoAndLinks();
  await linkContentToKeywords();
  console.log('\nDone. Optional: node scripts/seedSeoContentBatch.cjs --write && node scripts/runSeoContentPhase3.cjs --write');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
