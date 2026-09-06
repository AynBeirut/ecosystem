import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const sa = JSON.parse(readFileSync(resolve(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const docs = [
    'seo_technical/gsc_oauth',
    'seo_reporting/sitemap',
    'seo_canonical_health/grabio_space',
    'seo_technical/gsc_inspections',
  ];
  for (const path of docs) {
    const snap = await db.doc(path).get();
    console.log('===', path, snap.exists ? 'EXISTS' : 'MISSING');
    if (snap.exists) console.log(JSON.stringify(snap.data(), null, 2).slice(0, 3000));
  }

  const gscCols = ['seo_gsc_inspections', 'seo_url_inspections', 'gsc_inspections'];
  for (const col of gscCols) {
    const s = await db.collection(col).limit(3).get();
    if (!s.empty) console.log('COL', col, 'count sample', s.size);
  }

  // demo_start + recent cta_click try_demo
  const demo = await db.collection('seo_events').where('event_name', '==', 'demo_start').limit(5).get();
  console.log('demo_start count', demo.size);

  const cta = await db.collection('seo_events')
    .where('event_name', '==', 'cta_click')
    .orderBy('created_at', 'desc')
    .limit(10)
    .get()
    .catch(() => null);
  if (cta) {
    console.log('recent cta_click', cta.size);
    cta.docs.forEach((d) => console.log(JSON.stringify(d.data())));
  }

  // Any seo_events mentioning demo paths
  const pv = await db.collection('seo_events')
    .where('page_path', '>=', '/demo/')
    .where('page_path', '<', '/demo0')
    .limit(20)
    .get()
    .catch((e) => ({ err: e.message, empty: true, docs: [] }));
  if (pv.err) console.log('page_path range query failed:', pv.err);
  else {
    console.log('seo_events on /demo/* paths:', pv.docs?.length ?? pv.size);
    (pv.docs ?? []).forEach((d) => {
      const x = d.data();
      console.log(x.event_name, x.page_path, x.label, x.vertical);
    });
  }

  process.exit(0);
}

main();
