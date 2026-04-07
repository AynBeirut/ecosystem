/**
 * April 6 Physical Count — Full Correction
 * Applies client's physically verified stock as ground truth.
 * Also fixes 20 GSM quantity/currentStock sync gap.
 *
 * Usage:
 *   node scripts/applyApr6PhysicalCount.cjs          ← dry-run
 *   node scripts/applyApr6PhysicalCount.cjs --apply  ← apply
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const r3 = n => Math.round(Number(n) * 1000) / 1000;

const FG = [
  { docId: 'QDqWbvWzmnpcnMeoptcJ', name: 'INTERFOLD All Care 2Kg',  physical: 484,   field: 'currentBalance' },
  { docId: 'TAIADVDOGW9qc3nqBfw7', name: 'INTERFOLD All Care 3Kg',  physical: 115,   field: 'currentBalance' },
  { docId: 'oH1xI5su9rKsX7YvumJn', name: 'All Care Facial 2Kg',     physical: 599,   field: 'currentBalance' },
  { docId: 'AUMG5bjCZJ5FUxQhhpEt', name: 'All Care Facial 3Kg',     physical: 238,   field: 'currentBalance' },
  { docId: '7cboXdQaLnZR5hbXYQPV', name: 'All Care Facial 5Kg',     physical: 212,   field: 'currentBalance' },
];

const RM = [
  { docId: 'kPWepQNvyHlOZS03ZdSx', name: '14 GSM 2PLY 80CM',               physical: 3070  },
  { docId: 'CPDd3KJjKm8dwVDyQQ9o', name: '20 GSM 2PLY 80CM',               physical: 2141  },
  { docId: 'omNntXGXd0CYgW59GKyg', name: 'External Bag 40x90',             physical: 85    },
  { docId: 'sreO1wan2vR8ftKszz5I', name: 'External Bag 35x95',             physical: 75    },
  { docId: 'b44OHlJIIjrmvZ98zSzt', name: 'External Bag 35x80',             physical: 53.1  },
  { docId: 'NitmTPMiv0RUb0hxqXf9', name: 'External Bag 40x110',            physical: 66.4  },
  { docId: 'KMtX4iO3PtDJMDcNBO5z', name: 'INTERFOLD 200G Internal Bag',   physical: 65.5  },
  { docId: 'EhdSZHptBnc8zCCyJ6P0', name: 'INTERFOLD 300g Internal Bag',   physical: 158   },
  { docId: '21GG41A8bc4JWQybwYkk', name: '200g Facial Internal Bag',      physical: 83.6  },
  { docId: 'QUCkefY9LkkrfwOrihyr', name: '300G Facial Internal Bag',       physical: 127   },
  { docId: 'oUR9XVleCl8d2qQEjaNA', name: '500g Facial Internal Bag',       physical: 138.6 },
];

async function run() {
  console.log('\n' + '='.repeat(70));
  console.log('  April 6 Physical Count Correction');
  console.log('  Mode: ' + (APPLY ? '⚠️  APPLY' : '🔍 DRY-RUN'));
  console.log('='.repeat(70) + '\n');

  // ── Finished Goods ──────────────────────────────────────────────────────
  console.log('  📦 FINISHED GOODS:\n');
  for (const c of FG) {
    const snap = await db.collection('finishedGoodsInventory').doc(c.docId).get();
    const cur = r3(snap.data()?.currentBalance ?? 0);
    const diff = r3(c.physical - cur);
    console.log(`  ${c.name}`);
    console.log(`    current=${cur}  →  physical=${c.physical}  (${diff >= 0 ? '+' : ''}${diff})`);
    if (APPLY && diff !== 0) {
      const fgd = snap.data();
      await db.collection('finishedGoodsInventory').doc(c.docId).update({
        currentBalance: c.physical,
        totalValue: r3(c.physical * (fgd.costPrice || 0)),
        lastPhysicalCount: c.physical,
        lastPhysicalCountDate: '2026-04-06',
        lastPhysicalCountNote: 'Physical count correction 2026-04-06',
        updatedAt: new Date().toISOString(),
      });
      console.log(`    ✅ Updated`);
    } else if (diff === 0) {
      console.log(`    ✅ Already correct`);
    }
  }

  // ── Raw Materials ───────────────────────────────────────────────────────
  console.log('\n  🧻 RAW MATERIALS:\n');
  for (const c of RM) {
    const snap = await db.collection('rawMaterials').doc(c.docId).get();
    const cur = r3(snap.data()?.currentStock ?? snap.data()?.quantity ?? 0);
    const diff = r3(c.physical - cur);
    console.log(`  ${c.name}`);
    console.log(`    current=${cur}  →  physical=${c.physical}  (${diff >= 0 ? '+' : ''}${diff})`);
    if (APPLY && diff !== 0) {
      await db.collection('rawMaterials').doc(c.docId).update({
        currentStock: c.physical,
        quantity: c.physical,
        lastPhysicalCount: c.physical,
        lastPhysicalCountDate: '2026-04-06',
        lastPhysicalCountNote: 'Physical count correction 2026-04-06',
        updatedAt: new Date().toISOString(),
      });
      console.log(`    ✅ Updated`);
    } else if (diff === 0) {
      console.log(`    ✅ Already correct`);
    }
  }

  // ── Update shadow ledger baseline ───────────────────────────────────────
  if (APPLY) {
    console.log('\n  📊 Updating shadow ledger baseline...');
    const rmMap = {};
    RM.forEach(r => { rmMap[r.docId] = { name: r.name, kg: r.physical, baselineStock: r.physical }; });
    const fgMap = {};
    FG.forEach(f => { fgMap[f.docId] = { name: f.name, units: f.physical, baselineStock: f.physical }; });

    const baseData = {
      storeId: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
      date: '2026-04-06',
      rawMaterials: Object.entries(rmMap).map(([docId, v]) => ({ docId, ...v })),
      finishedGoods: Object.entries(fgMap).map(([docId, v]) => ({ docId, ...v })),
      lastAmended: '2026-04-06',
      amendNote: 'Physical count reset — Apr 6 ground truth',
    };

    await db.collection('shadowLedger').doc('nipco-active-baseline').set(baseData);
    await db.collection('shadowLedger').doc('nipco-baseline-2026-04-06').set(baseData);
    console.log('  ✅ Shadow ledger baseline replaced with April 6 count');
  }

  console.log('\n' + '='.repeat(70) + '\n');
  if (!APPLY) console.log('  Run with --apply to write to Firestore.\n');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
