/**
 * NIPCO CRM — set nextFollowUpAt for all customers by registered address (district · area)
 * within the next 30 days. Admin visit routes override via mobile createVisitRoute.
 *
 * Usage:
 *   node scripts/nipcoScheduleCrmVisits.cjs           # apply
 *   node scripts/nipcoScheduleCrmVisits.cjs --dry-run # preview only
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const HORIZON_DAYS = 30;
const DRY_RUN = process.argv.includes('--dry-run');

function registeredAddressBucket(c) {
  const district = String(c.district || '').trim();
  const area = String(c.area || '').trim();
  if (district || area) return `${district || '—'} · ${area || '—'}`;
  const addr = String(c.address || '').trim();
  return addr ? `addr:${addr.toLowerCase()}` : 'Unknown location';
}

function computeSchedule(clients, startDate, horizonDays) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const byBucket = new Map();
  for (const c of clients) {
    const key = registeredAddressBucket(c);
    if (!byBucket.has(key)) byBucket.set(key, []);
    byBucket.get(key).push(c);
  }
  const buckets = [...byBucket.keys()].sort((a, b) => a.localeCompare(b));
  const schedule = [];
  buckets.forEach((bucket, idx) => {
    const dayOffset = idx % horizonDays;
    const list = byBucket.get(bucket);
    list.forEach((c, slotIndex) => {
      const d = new Date(start);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(9, 0, 0, 0);
      d.setMinutes(d.getMinutes() + slotIndex * 5);
      schedule.push({
        id: c.id,
        name: c.name || c.id,
        bucket,
        nextFollowUpAt: d.toISOString(),
      });
    });
  });
  return schedule;
}

async function run() {
  const snap = await db.collection('customers').where('storeId', '==', STORE_ID).get();
  const clients = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`NIPCO customers: ${clients.length}`);

  const schedule = computeSchedule(clients, new Date(), HORIZON_DAYS);
  const bucketCount = new Set(schedule.map((s) => s.bucket)).size;
  console.log(`Address buckets: ${bucketCount} → spread across ${HORIZON_DAYS} days`);

  schedule.slice(0, 15).forEach((s) => {
    console.log(`  ${s.bucket.padEnd(36)} ${s.name.slice(0, 24).padEnd(24)} ${s.nextFollowUpAt.slice(0, 10)}`);
  });
  if (schedule.length > 15) console.log(`  … +${schedule.length - 15} more`);

  if (DRY_RUN) {
    console.log('Dry run — no writes.');
    process.exit(0);
  }

  const now = new Date().toISOString();
  let updated = 0;
  for (let i = 0; i < schedule.length; i += 400) {
    const batch = db.batch();
    const chunk = schedule.slice(i, i + 400);
    for (const row of chunk) {
      batch.update(db.collection('customers').doc(row.id), {
        nextFollowUpAt: row.nextFollowUpAt,
        nextVisitScheduledBy: 'auto_address',
        nextVisitRouteId: admin.firestore.FieldValue.delete(),
        updatedAt: now,
      });
    }
    await batch.commit();
    updated += chunk.length;
    console.log(`Committed ${updated}/${schedule.length}`);
  }

  console.log('Done.');
  process.exit(0);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
