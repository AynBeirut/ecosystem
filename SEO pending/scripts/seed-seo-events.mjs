/**
 * Seed seo_events with realistic traffic data (Mar 25 – Apr 30, 2026)
 * Run: node scripts/seed-seo-events.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../serviceAccountKey.json'), 'utf8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Daily target events (37 days)
const DAILY = [
  { date: '2026-03-25', count:  980 }, { date: '2026-03-26', count: 1120 },
  { date: '2026-03-27', count: 1340 }, { date: '2026-03-28', count: 1210 },
  { date: '2026-03-29', count: 1480 }, { date: '2026-03-30', count: 1620 },
  { date: '2026-03-31', count: 1750 }, { date: '2026-04-01', count: 1690 },
  { date: '2026-04-02', count: 1580 }, { date: '2026-04-03', count: 1810 },
  { date: '2026-04-04', count: 1940 }, { date: '2026-04-05', count: 1870 },
  { date: '2026-04-06', count: 2050 }, { date: '2026-04-07', count: 2180 },
  { date: '2026-04-08', count: 2340 }, { date: '2026-04-09', count: 2560 },
  { date: '2026-04-10', count: 2420 }, { date: '2026-04-11', count: 2290 },
  { date: '2026-04-12', count: 2170 }, { date: '2026-04-13', count: 2480 },
  { date: '2026-04-14', count: 2650 }, { date: '2026-04-15', count: 2510 },
  { date: '2026-04-16', count: 2820 }, { date: '2026-04-17', count: 3040 },
  { date: '2026-04-18', count: 2910 }, { date: '2026-04-19', count: 2730 },
  { date: '2026-04-20', count: 3190 }, { date: '2026-04-21', count: 3070 },
  { date: '2026-04-22', count: 2940 }, { date: '2026-04-23', count: 2810 },
  { date: '2026-04-24', count: 3050 }, { date: '2026-04-25', count: 3210 },
  { date: '2026-04-26', count: 3080 }, { date: '2026-04-27', count: 3340 },
  { date: '2026-04-28', count: 3520 }, { date: '2026-04-29', count: 3680 },
  { date: '2026-04-30', count: 3490 },
];

// Page distribution weights
const PAGES = [
  { path: '/',                  weight: 17.8 },
  { path: '/features',          weight: 11.1 },
  { path: '/pricing',           weight:  9.9 },
  { path: '/blog',              weight:  7.8 },
  { path: '/marketplace',       weight:  6.9 },
  { path: '/store-owner-guide', weight:  6.1 },
  { path: '/contact',           weight:  5.6 },
  { path: '/about',             weight:  4.3 },
  { path: '/use-cases',         weight:  3.8 },
  { path: '/sitemap.xml',       weight:  3.0 },
];
const totalWeight = PAGES.reduce((s, p) => s + p.weight, 0);

function pickPage() {
  let r = Math.random() * totalWeight;
  for (const p of PAGES) {
    r -= p.weight;
    if (r <= 0) return p.path;
  }
  return '/';
}

function randomSession() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function randomTs(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setSeconds(Math.floor(Math.random() * 86400));
  return Timestamp.fromDate(d);
}

const BATCH_SIZE = 400;

async function seed() {
  console.log('Seeding seo_events…');
  let total = 0;

  for (const { date, count } of DAILY) {
    // Each day: generate sessions first, then assign events
    const numSessions = Math.round(count * 0.68);
    const sessions = Array.from({ length: numSessions }, randomSession);

    let i = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (let e = 0; e < count; e++) {
      const session_id = sessions[e % sessions.length];
      const ref = db.collection('seo_events').doc();
      batch.set(ref, {
        session_id,
        page_path: pickPage(),
        event_name: 'page_view',
        created_at: randomTs(date),
      });
      batchCount++;
      total++;

      if (batchCount === BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        process.stdout.write(`\r  ${date} — ${total} events written`);
      }
    }
    if (batchCount > 0) {
      await batch.commit();
      process.stdout.write(`\r  ${date} — ${total} events written`);
    }
    i++;
  }

  console.log(`\nDone. Total events written: ${total}`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
