/**
 * Delete all seo_events then seed Feb 1 – Apr 30, 2026 (~70k total, growing)
 * Run: node scripts/reseed-seo-events.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../../serviceAccountKey.json'), 'utf8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Step 1: Delete existing seo_events ──────────────────────────────────────
async function deleteCollection(collName) {
  let deleted = 0;
  while (true) {
    const snap = await db.collection(collName).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    process.stdout.write(`\r  Deleting… ${deleted} removed`);
  }
  console.log(`\n  Deleted ${deleted} existing docs.`);
}

// ─── Step 2: Daily plan — Feb 1 → Apr 30 (89 days) ─────────────────────────
const DAILY = [
  // ── February ──
  { date: '2026-02-01', count:  315 }, { date: '2026-02-02', count:  341 },
  { date: '2026-02-03', count:  368 }, { date: '2026-02-04', count:  394 },
  { date: '2026-02-05', count:  350 }, { date: '2026-02-06', count:  376 },
  { date: '2026-02-07', count:  403 }, { date: '2026-02-08', count:  429 },
  { date: '2026-02-09', count:  455 }, { date: '2026-02-10', count:  420 },
  { date: '2026-02-11', count:  446 }, { date: '2026-02-12', count:  473 },
  { date: '2026-02-13', count:  499 }, { date: '2026-02-14', count:  525 },
  { date: '2026-02-15', count:  481 }, { date: '2026-02-16', count:  508 },
  { date: '2026-02-17', count:  543 }, { date: '2026-02-18', count:  569 },
  { date: '2026-02-19', count:  595 }, { date: '2026-02-20', count:  551 },
  { date: '2026-02-21', count:  578 }, { date: '2026-02-22', count:  613 },
  { date: '2026-02-23', count:  639 }, { date: '2026-02-24', count:  621 },
  { date: '2026-02-25', count:  648 }, { date: '2026-02-26', count:  665 },
  { date: '2026-02-27', count:  656 }, { date: '2026-02-28', count:  683 },
  // ── March ──
  { date: '2026-03-01', count:  718 }, { date: '2026-03-02', count:  753 },
  { date: '2026-03-03', count:  788 }, { date: '2026-03-04', count:  735 },
  { date: '2026-03-05', count:  779 }, { date: '2026-03-06', count:  823 },
  { date: '2026-03-07', count:  866 }, { date: '2026-03-08', count:  910 },
  { date: '2026-03-09', count:  945 }, { date: '2026-03-10', count:  884 },
  { date: '2026-03-11', count:  928 }, { date: '2026-03-12', count:  980 },
  { date: '2026-03-13', count: 1033 }, { date: '2026-03-14', count: 1085 },
  { date: '2026-03-15', count: 1138 }, { date: '2026-03-16', count: 1068 },
  { date: '2026-03-17', count: 1120 }, { date: '2026-03-18', count: 1190 },
  { date: '2026-03-19', count: 1260 }, { date: '2026-03-20', count: 1330 },
  { date: '2026-03-21', count: 1400 }, { date: '2026-03-22', count: 1313 },
  { date: '2026-03-23', count: 1383 }, { date: '2026-03-24', count: 1470 },
  { date: '2026-03-25', count: 1558 }, { date: '2026-03-26', count: 1645 },
  { date: '2026-03-27', count: 1715 }, { date: '2026-03-28', count: 1610 },
  { date: '2026-03-29', count: 1698 }, { date: '2026-03-30', count: 1803 },
  { date: '2026-03-31', count: 1925 },
  // ── April ──
  { date: '2026-04-01', count: 2013 }, { date: '2026-04-02', count: 2118 },
  { date: '2026-04-03', count: 2240 }, { date: '2026-04-04', count: 2363 },
  { date: '2026-04-05', count: 2205 }, { date: '2026-04-06', count: 2328 },
  { date: '2026-04-07', count: 2468 }, { date: '2026-04-08', count: 2608 },
  { date: '2026-04-09', count: 2748 }, { date: '2026-04-10', count: 2590 },
  { date: '2026-04-11', count: 2730 }, { date: '2026-04-12', count: 2888 },
  { date: '2026-04-13', count: 3045 }, { date: '2026-04-14', count: 3203 },
  { date: '2026-04-15', count: 3010 }, { date: '2026-04-16', count: 3168 },
  { date: '2026-04-17', count: 3343 }, { date: '2026-04-18', count: 3518 },
  { date: '2026-04-19', count: 3308 }, { date: '2026-04-20', count: 3483 },
  { date: '2026-04-21', count: 3675 }, { date: '2026-04-22', count: 3868 },
  { date: '2026-04-23', count: 3640 }, { date: '2026-04-24', count: 3833 },
  { date: '2026-04-25', count: 4043 }, { date: '2026-04-26', count: 4270 },
  { date: '2026-04-27', count: 4008 }, { date: '2026-04-28', count: 4480 },
  { date: '2026-04-29', count: 4725 }, { date: '2026-04-30', count: 4988 },
];

const total = DAILY.reduce((s, d) => s + d.count, 0);
console.log(`Planned total: ${total.toLocaleString()} events across ${DAILY.length} days`);

// ─── Page distribution ────────────────────────────────────────────────────────
const PAGES = [
  { path: '/',                  weight: 18.2 },
  { path: '/features',          weight: 11.5 },
  { path: '/pricing',           weight: 10.1 },
  { path: '/blog',              weight:  8.3 },
  { path: '/marketplace',       weight:  7.1 },
  { path: '/store-owner-guide', weight:  6.2 },
  { path: '/contact',           weight:  5.8 },
  { path: '/about',             weight:  4.5 },
  { path: '/use-cases',         weight:  4.0 },
  { path: '/sitemap.xml',       weight:  3.1 },
];
const totalWeight = PAGES.reduce((s, p) => s + p.weight, 0);

function pickPage() {
  let r = Math.random() * totalWeight;
  for (const p of PAGES) { r -= p.weight; if (r <= 0) return p.path; }
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
  let written = 0;
  for (const { date, count } of DAILY) {
    const numSessions = Math.round(count * 0.68);
    const sessions = Array.from({ length: numSessions }, randomSession);
    let batch = db.batch();
    let batchCount = 0;
    for (let e = 0; e < count; e++) {
      const ref = db.collection('seo_events').doc();
      batch.set(ref, {
        session_id : sessions[e % sessions.length],
        page_path  : pickPage(),
        event_name : 'page_view',
        created_at : randomTs(date),
      });
      batchCount++; written++;
      if (batchCount === BATCH_SIZE) {
        await batch.commit();
        batch = db.batch(); batchCount = 0;
        process.stdout.write(`\r  Seeding… ${written.toLocaleString()} written`);
      }
    }
    if (batchCount > 0) { await batch.commit(); }
    process.stdout.write(`\r  Seeding… ${written.toLocaleString()} written`);
  }
  console.log(`\nDone. Total events written: ${written.toLocaleString()}`);
  process.exit(0);
}

async function main() {
  console.log('\n── Step 1: Clear existing seo_events ──');
  await deleteCollection('seo_events');
  console.log('\n── Step 2: Seed fresh data ──');
  await seed();
}

main().catch(e => { console.error(e); process.exit(1); });
