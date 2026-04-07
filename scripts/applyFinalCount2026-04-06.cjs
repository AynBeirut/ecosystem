/**
 * Apply Final Physical Count — 2026-04-06 (applied 2026-04-07)
 * Ground truth from client after full recount.
 *
 * Usage:
 *   node scripts/applyFinalCount2026-04-06.cjs          ← dry-run
 *   node scripts/applyFinalCount2026-04-06.cjs --apply  ← write to Firestore
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const r3 = n => Math.round(Number(n) * 1000) / 1000;

// ── FINISHED GOODS ────────────────────────────────────────────────────────────
const FG = [
  { docId: 'QDqWbvWzmnpcnMeoptcJ', name: 'INTERFOLD All Care 2Kg  (تنشيف 200)', physical: 484   },
  { docId: 'TAIADVDOGW9qc3nqBfw7', name: 'INTERFOLD All Care 3Kg  (تنشيف 300)', physical: 115   },
  { docId: 'oH1xI5su9rKsX7YvumJn', name: 'All Care Facial 2Kg     (ناعم 200)',  physical: 599   },
  { docId: 'AUMG5bjCZJ5FUxQhhpEt', name: 'All Care Facial 3Kg     (ناعم 300)',  physical: 238   },
  { docId: '7cboXdQaLnZR5hbXYQPV', name: 'All Care Facial 5Kg     (ناعم 500)',  physical: 212   },
];

// ── RAW MATERIALS ─────────────────────────────────────────────────────────────
// GSM NOTE: client confirmed explicitly:
//   14 GSM  →  2141 kg   (kPWepQNvyHlOZS03ZdSx)
//   20 GSM  →  4069 kg   (CPDd3KJjKm8dwVDyQQ9o)
const RM = [
  { docId: 'kPWepQNvyHlOZS03ZdSx', name: '14 GSM 2PLY 80CM',                   physical: 2141  },
  { docId: 'CPDd3KJjKm8dwVDyQQ9o', name: '20 GSM 2PLY 80CM',                   physical: 4069  },
  { docId: 'omNntXGXd0CYgW59GKyg', name: 'External Bag 40×90',                 physical: 85    },
  { docId: 'sreO1wan2vR8ftKszz5I', name: 'External Bag 35×95',                  physical: 75    },
  { docId: 'b44OHlJIIjrmvZ98zSzt', name: 'External Bag 35×80',                  physical: 53.1  },
  { docId: 'NitmTPMiv0RUb0hxqXf9', name: 'External Bag 40×110',                 physical: 66.4  },
  { docId: 'KMtX4iO3PtDJMDcNBO5z', name: 'INTERFOLD 200G Internal Bag',         physical: 65.5  },
  { docId: 'EhdSZHptBnc8zCCyJ6P0', name: 'INTERFOLD 300G Internal Bag',         physical: 158   },
  { docId: '21GG41A8bc4JWQybwYkk', name: '200g Facial Internal Bag',            physical: 83.6  },
  { docId: 'QUCkefY9LkkrfwOrihyr', name: '300G Facial Internal Bag',            physical: 127   },
  { docId: 'oUR9XVleCl8d2qQEjaNA', name: '500g Facial Internal Bag',            physical: 138.6 },
  // 42×112 = 10 kg — searched below, create if not found
];

async function run() {
  console.log('\n' + '='.repeat(70));
  console.log('  Final Physical Count — 2026-04-06');
  console.log('  Mode: ' + (APPLY ? '⚠️  APPLY (writing to Firestore)' : '🔍 DRY-RUN'));
  console.log('='.repeat(70));

  // ── Finished Goods ────────────────────────────────────────────────────────
  console.log('\n  📦 FINISHED GOODS\n');
  for (const c of FG) {
    const snap = await db.collection('finishedGoodsInventory').doc(c.docId).get();
    if (!snap.exists) { console.log(`  ❌ NOT FOUND: ${c.docId}`); continue; }
    const current = r3(Number(snap.data().currentBalance ?? 0));
    const diff = r3(c.physical - current);
    console.log(`  ${c.name}`);
    console.log(`    system=${current}  →  physical=${c.physical}  (${diff >= 0 ? '+' : ''}${diff})`);
    if (APPLY) {
      const fgd = snap.data();
      const cost = Number(fgd.costPrice || 0);
      await db.collection('finishedGoodsInventory').doc(c.docId).update({
        currentBalance: c.physical,
        totalValue: r3(c.physical * cost),
        lastPhysicalCount: c.physical,
        lastPhysicalCountDate: '2026-04-06',
        lastPhysicalCountNote: 'Final recount 2026-04-06 applied 2026-04-07',
        updatedAt: new Date().toISOString(),
      });
      console.log(`    ✅ Updated`);
    }
  }

  // ── Raw Materials ─────────────────────────────────────────────────────────
  console.log('\n  🧻 RAW MATERIALS\n');
  for (const c of RM) {
    const snap = await db.collection('rawMaterials').doc(c.docId).get();
    if (!snap.exists) { console.log(`  ❌ NOT FOUND: ${c.docId} (${c.name})`); continue; }
    const current = r3(Number(snap.data().currentStock ?? snap.data().quantity ?? 0));
    const diff = r3(c.physical - current);
    console.log(`  ${c.name}`);
    console.log(`    system=${current}  →  physical=${c.physical}  (${diff >= 0 ? '+' : ''}${diff})`);
    if (APPLY) {
      await db.collection('rawMaterials').doc(c.docId).update({
        currentStock: c.physical,
        quantity: c.physical,
        lastPhysicalCount: c.physical,
        lastPhysicalCountDate: '2026-04-06',
        lastPhysicalCountNote: 'Final recount 2026-04-06 applied 2026-04-07',
        updatedAt: new Date().toISOString(),
      });
      console.log(`    ✅ Updated`);
    }
  }

  // ── 42×112 external bag — find or note ────────────────────────────────────
  console.log('\n  External Bag 42×112 (10 kg) — searching...');
  const bagSnap = await db.collection('rawMaterials')
    .where('storeId', '==', STORE_ID).get();
  const bag42 = bagSnap.docs.find(d => {
    const n = (d.data().name || '').toLowerCase();
    return n.includes('42') || n.includes('112');
  });
  if (bag42) {
    const cur = r3(Number(bag42.data().currentStock ?? bag42.data().quantity ?? 0));
    console.log(`  Found: ${bag42.data().name}  (${bag42.id})  system=${cur}  →  physical=10`);
    if (APPLY) {
      await db.collection('rawMaterials').doc(bag42.id).update({
        currentStock: 10, quantity: 10,
        lastPhysicalCount: 10, lastPhysicalCountDate: '2026-04-06',
        updatedAt: new Date().toISOString(),
      });
      console.log('  ✅ Updated');
    }
  } else {
    console.log('  ⚠️  42×112 bag not found in rawMaterials — not tracked in system yet. No action taken.');
  }

  // ── Update shadow ledger baseline ─────────────────────────────────────────
  if (APPLY) {
    console.log('\n  Updating shadow ledger baseline...');
    const rmMap = {};
    for (const c of RM) rmMap[c.docId] = { name: c.name, kg: c.physical, baselineStock: c.physical };
    if (bag42) rmMap[bag42.id] = { name: bag42.data().name, kg: 10, baselineStock: 10 };

    const fgMap = {};
    for (const c of FG) fgMap[c.docId] = { name: c.name, units: c.physical, baselineStock: c.physical };

    for (const bname of ['nipco-active-baseline', 'nipco-baseline-2026-03-31']) {
      const ref = db.collection('shadowLedger').doc(bname);
      const snap = await ref.get();
      if (!snap.exists) { console.log(`  ⚠️  ${bname} not found`); continue; }
      const data = snap.data();

      // Merge: update existing entries, keep extra fields intact
      const existRM = data.rawMaterials || {};
      for (const [id, val] of Object.entries(rmMap)) {
        existRM[id] = { ...(existRM[id] || {}), ...val };
      }
      const existFG = data.finishedGoods || [];
      if (Array.isArray(existFG)) {
        for (let i = 0; i < existFG.length; i++) {
          const m = fgMap[existFG[i].docId];
          if (m) { existFG[i] = { ...existFG[i], units: m.units, baselineStock: m.units }; }
        }
      }

      await ref.update({
        rawMaterials: existRM,
        finishedGoods: existFG,
        date: '2026-04-06',
        lastAmended: '2026-04-07',
        amendNote: 'Final recount 2026-04-06',
      });
      console.log(`  ✅ ${bname} updated`);
    }
  }

  if (!APPLY) console.log('\n  Run with --apply to commit these changes.');
  console.log('\n' + '='.repeat(70) + '\n');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
