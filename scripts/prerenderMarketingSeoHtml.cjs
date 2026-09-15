#!/usr/bin/env node
/**
 * Post-build: static HTML shells for /demo/* and /compare/* with correct <title> and meta
 * so crawlers receive SEO tags without waiting for React hydration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');
const BASE = 'https://grabio.space';

const DEMO_SLUGS = ['shop', 'cafe', 'restaurant', 'manufacturing', 'ecommerce'];
const STATIC_ROUTES = [
  {
    path: '/',
    title: 'Fine Dining & Restaurant Operations Software | Grabio',
    description:
      'Grabio helps fine dining and full-service venues run floor service, reservations, guest CRM, kitchen flow, and POS on one platform — optional inventory and finance when you need them.',
  },
  {
    path: '/search',
    title: 'Grabio Marketplace | Local Stores and Products in Lebanon',
    description:
      'Discover local stores and products on Grabio Marketplace, connected to live storefronts, catalog management, inventory, and order workflows.',
  },
  {
    path: '/features',
    title: 'Grabio Features | POS, Inventory, Accounting, CRM and Ecommerce',
    description:
      'Explore Grabio features for small businesses: POS, inventory, invoicing, accounting, CRM, delivery, ecommerce, manufacturing, and analytics.',
  },
  {
    path: '/pricing',
    title: 'Grabio Pricing | Modular Business Software Plans',
    description:
      'Compare Grabio modular plans for POS, inventory, invoicing, ecommerce, restaurant, manufacturing, accounting, and business automation.',
  },
  {
    path: '/solutions',
    title: 'Grabio Solutions | Business Software by Workflow and Industry',
    description:
      'Browse Grabio solutions for inventory, POS, accounting, mobile apps, restaurant operations, manufacturing, ecommerce, CRM, and AI workflows.',
  },
  {
    path: '/solutions/inventory',
    title: 'Inventory Management Software for Small Business | Grabio',
    description:
      'Control stock, purchases, product availability, multi-location inventory, and valuation with Grabio inventory management software.',
  },
  {
    path: '/solutions/accounting',
    title: 'Accounting and Invoicing Software for SMBs | Grabio',
    description:
      'Run invoicing, payments, receivables, payables, statements, dual-currency workflows, and Lebanese PCG-ready accounting in Grabio.',
  },
  {
    path: '/solutions/pos',
    title: 'POS Software Connected to Inventory and Invoicing | Grabio',
    description:
      'Use Grabio POS for counter sales, barcode workflows, orders, payments, inventory deduction, invoices, and daily business reporting.',
  },
  {
    path: '/solutions/restaurant',
    title: 'Restaurant POS, Kitchen and Food Cost Software | Grabio',
    description:
      'Manage tables, kitchen orders, menu items, recipes, ingredient stock, delivery, and restaurant reporting with Grabio.',
  },
  {
    path: '/solutions/manufacturing',
    title: 'Manufacturing ERP and BOM Software for Small Business | Grabio',
    description:
      'Plan production, manage BOMs, consume raw materials, complete finished goods, and sell manufactured products from one Grabio platform.',
  },
];

function readTsString(filePath, key) {
  const text = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`${key}:\\s*'((?:\\\\'|[^'])*)'`, 'm');
  const match = text.match(re);
  if (!match) throw new Error(`Missing ${key} in ${filePath}`);
  return match[1].replace(/\\'/g, "'");
}

function readTsMultilineString(filePath, key) {
  const text = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`${key}:\\s*\\n\\s*'((?:\\\\'|[^'])*)'`, 'm');
  const match = text.match(re);
  if (!match) throw new Error(`Missing ${key} in ${filePath}`);
  return match[1].replace(/\\'/g, "'");
}

function readComparisonSlugs() {
  const text = fs.readFileSync(path.join(ROOT, 'src/data/marketing/comparisonPages.ts'), 'utf8');
  const slugs = [];
  const re = /slug:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(text))) slugs.push(m[1]);
  return slugs;
}

function readDemoOsMeta() {
  const text = fs.readFileSync(path.join(ROOT, 'src/data/marketing/demoOsCatalog.ts'), 'utf8');
  const routes = [
    {
      path: '/demo-os',
      title: 'Grabio Admin Demo | Dashboard, POS, Inventory & Finance Preview',
      description:
        'Tour Grabio internal admin screens — dashboard, POS, orders, inventory, invoicing, accounting, CRM, and AI. Read-only previews; sign in to run your store.',
    },
  ];

  const moduleRe =
    /id:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:\\'|[^'])*)'[\s\S]*?metaDescription:\s*\n\s*'((?:\\'|[^'])*)'/g;
  let match;
  while ((match = moduleRe.exec(text))) {
    routes.push({
      path: `/demo-os/${match[1]}`,
      title: match[2].replace(/\\'/g, "'"),
      description: match[3].replace(/\\'/g, "'"),
    });
  }

  return routes;
}

function readDemoPreviewMeta() {
  const text = fs.readFileSync(path.join(ROOT, 'src/data/marketing/demoPreviewCatalog.ts'), 'utf8');
  const routes = [];

  const verticalRe =
    /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:\\'|[^'])*)'[\s\S]*?metaDescription:\s*\n\s*'((?:\\'|[^'])*)'/g;
  let match;
  while ((match = verticalRe.exec(text))) {
    routes.push({
      path: `/demo/${match[1]}/app`,
      title: match[2].replace(/\\'/g, "'"),
      description: match[3].replace(/\\'/g, "'"),
    });
  }

  const featureRe =
    /moduleId:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:\\'|[^'])*)'[\s\S]*?metaDescription:\s*\n\s*'((?:\\'|[^'])*)'/g;
  while ((match = featureRe.exec(text))) {
    routes.push({
      path: `/features/${match[1]}/app`,
      title: match[2].replace(/\\'/g, "'"),
      description: match[3].replace(/\\'/g, "'"),
    });
  }

  return routes;
}

function readComparisonMeta(slug) {
  const text = fs.readFileSync(path.join(ROOT, 'src/data/marketing/comparisonPages.ts'), 'utf8');
  const blockRe = new RegExp(
    `slug:\\s*'${slug}'[\\s\\S]*?metaTitle:\\s*'((?:\\\\'|[^'])*)'[\\s\\S]*?metaDescription:\\s*\\n\\s*'((?:\\\\'|[^'])*)'`,
    'm',
  );
  const match = text.match(blockRe);
  if (!match) throw new Error(`Missing comparison meta for ${slug}`);
  return {
    title: match[1].replace(/\\'/g, "'"),
    description: match[2].replace(/\\'/g, "'"),
  };
}

function injectMeta(html, { title, description, url }) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeAttr(description)}" />`,
  );
  const headExtras = [
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ');
  if (!out.includes('rel="canonical"')) {
    out = out.replace('</head>', `    ${headExtras}\n  </head>`);
  }
  return out;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function writeRouteHtml(routePath, meta) {
  const url = `${BASE}${routePath}`;
  const html = injectMeta(baseHtml, { ...meta, url });
  const outDir = path.join(ROOT, 'dist', ...routePath.split('/').filter(Boolean));
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'index.html');
  fs.writeFileSync(outFile, html);
  return outFile;
}

if (!fs.existsSync(DIST_INDEX)) {
  console.error('❌ dist/index.html missing — run vite build first');
  process.exit(1);
}

const baseHtml = fs.readFileSync(DIST_INDEX, 'utf8');
const written = [];

for (const route of STATIC_ROUTES) {
  written.push(writeRouteHtml(route.path, { title: route.title, description: route.description }));
}

for (const slug of DEMO_SLUGS) {
  const file = path.join(ROOT, 'src/data/marketing/content', `${slug}.ts`);
  const title = readTsString(file, 'metaTitle');
  const description = readTsMultilineString(file, 'metaDescription');
  written.push(writeRouteHtml(`/demo/${slug}`, { title, description }));
}

for (const slug of readComparisonSlugs()) {
  const { title, description } = readComparisonMeta(slug);
  written.push(writeRouteHtml(`/compare/${slug}`, { title, description }));
}

for (const route of readDemoPreviewMeta()) {
  written.push(writeRouteHtml(route.path, { title: route.title, description: route.description }));
}

for (const route of readDemoOsMeta()) {
  written.push(writeRouteHtml(route.path, { title: route.title, description: route.description }));
}

console.log(`✅ Prerendered ${written.length} marketing SEO HTML shells`);
for (const file of written) {
  console.log(`   ${path.relative(ROOT, file)}`);
}
