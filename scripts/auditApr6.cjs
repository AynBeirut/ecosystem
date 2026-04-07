/**
 * April 6 Physical Count Audit
 * Compares live Firestore values vs client's physical count
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
const db = admin.firestore();
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const r3 = n => Math.round(Number(n) * 1000) / 1000;

// Physical count as provided by client 2026-04-06
// Note: "شغل اليوم 290 طرد تنشيف 200" = 290 INTERFOLD 2Kg produced today (already in count)
const PHYSICAL = {
  fg: {
    'QDqWbvWzmnpcnMeoptcJ': { name: 'INTERFOLD All Care 2Kg (تنشيف 200)',  physical: 484  },
    'TAIADVDOGW9qc3nqBfw7': { name: 'INTERFOLD All Care 3Kg (تنشيف 300)',  physical: 115  },
    'oH1xI5su9rKsX7YvumJn': { name: 'All Care Facial 2Kg (ناعم 200)',      physical: 599  },
    'AUMG5bjCZJ5FUxQhhpEt': { name: 'All Care Facial 3Kg (ناعم 300)',       physical: 238  },
    '7cboXdQaLnZR5hbXYQPV': { name: 'All Care Facial 5Kg (ناعم 500)',       physical: 212  },
  },
  rm: {
    'kPWepQNvyHlOZS03ZdSx': { name: '14 GSM 2PLY 80CM (تنشيف)',            physical: 3070  },
    'CPDd3KJjKm8dwVDyQQ9o': { name: '20 GSM 2PLY 80CM (ناعم)',             physical: 2141  },
    'omNntXGXd0CYgW59GKyg': { name: 'External Bag 40x90',                  physical: 85    },
    'sreO1wan2vR8ftKszz5I': { name: 'External Bag 35x95',                  physical: 75    },
    'b44OHlJIIjrmvZ98zSzt': { name: 'External Bag 35x80',                  physical: 53.1  },
    'NitmTPMiv0RUb0hxqXf9': { name: 'External Bag 40x110',                 physical: 66.4  },
    'KMtX4iO3PtDJMDcNBO5z': { name: 'INTERFOLD 200G Internal Bag (تنشيف)', physical: 65.5  },
    'EhdSZHptBnc8zCCyJ6P0': { name: 'INTERFOLD 300g Internal Bag (تنشيف)', physical: 158   },
    '21GG41A8bc4JWQybwYkk': { name: '200g Facial Internal Bag (ناعم)',     physical: 83.6  },
    'QUCkefY9LkkrfwOrihyr': { name: '300G Facial Internal Bag (ناعم)',     physical: 127   },
    'oUR9XVleCl8d2qQEjaNA': { name: '500g Facial Internal Bag (ناعم)',     physical: 138.6 },
  }
};

async function run() {
  console.log('\n' + '='.repeat(72));
  console.log('  NIPCO Physical Count Audit — 2026-04-06');
  console.log('  Note: 290 INTERFOLD 2Kg produced today (שגל اليوم)');
  console.log('='.repeat(72));

  // Also fetch recent production batches and purchases (since Apr 1)
  const since = new Date('2026-04-01T23:59:59.000Z');

  const batchSnap = await db.collection('productionBatches')
    .where('storeId','==',STORE_ID).where('status','==','completed').get();
  const batches = batchSnap.docs
    .filter(d => {
      const b = d.data();
      const dt = b.completionDate ? new Date(b.completionDate) : null;
      return dt && dt > since;
    })
    .map(d => ({ id: d.id, ...d.data() }));

  const purchSnap = await db.collection('purchases')
    .where('storeId','==',STORE_ID).where('status','==','received').get();
  const purchases = purchSnap.docs
    .filter(d => {
      const p = d.data();
      const dt = p.receivedDate ? new Date(p.receivedDate) : (p.updatedAt ? new Date(p.updatedAt) : null);
      return dt && dt > since;
    })
    .map(d => ({ id: d.id, ...d.data() }));

  console.log('\n  📋 Activity since Apr 1:');
  console.log('  Production batches completed:');
  if (batches.length === 0) console.log('    — none');
  batches.forEach(b => console.log(`    ${b.completionDate?.slice(0,10)}  ${b.productName}  qty=${b.actualQuantity}  batch=${b.batchNumber || b.id.slice(-8)}`));

  console.log('  Purchases received:');
  if (purchases.length === 0) console.log('    — none');
  purchases.forEach(p => {
    const items = (p.items||[]).map(i => `${i.materialName} +${i.receivedQuantity||i.quantity}kg`).join(', ');
    console.log(`    ${(p.receivedDate||p.updatedAt||'').slice(0,10)}  ${p.invoiceNumber||p.id.slice(-8)}  ${items}`);
  });

  // ── FG comparison ────────────────────────────────────────────────────────
  console.log('\n  ' + '─'.repeat(68));
  console.log('  📦 FINISHED GOODS\n');
  const fgIssues = [];
  for (const [docId, info] of Object.entries(PHYSICAL.fg)) {
    const snap = await db.collection('finishedGoodsInventory').doc(docId).get();
    const actual = r3(Number(snap.data()?.currentBalance ?? 0));
    const diff = r3(actual - info.physical);
    const ok = Math.abs(diff) <= 0.5;
    console.log(`  ${ok ? '✅' : '❌'} ${info.name}`);
    console.log(`     system=${actual}  physical=${info.physical}  diff=${diff >= 0 ? '+' : ''}${diff}`);
    if (!ok) fgIssues.push({ ...info, actual, diff, docId });
  }

  // ── RM comparison ────────────────────────────────────────────────────────
  console.log('\n  ' + '─'.repeat(68));
  console.log('  🧻 RAW MATERIALS\n');
  const rmIssues = [];
  for (const [docId, info] of Object.entries(PHYSICAL.rm)) {
    const snap = await db.collection('rawMaterials').doc(docId).get();
    const actual = r3(Number(snap.data()?.currentStock ?? snap.data()?.quantity ?? 0));
    const diff = r3(actual - info.physical);
    const ok = Math.abs(diff) <= 0.5;
    console.log(`  ${ok ? '✅' : '❌'} ${info.name}`);
    console.log(`     system=${actual}  physical=${info.physical}  diff=${diff >= 0 ? '+' : ''}${diff}`);
    if (!ok) rmIssues.push({ ...info, actual, diff, docId });
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = fgIssues.length + rmIssues.length;
  console.log('\n  ' + '='.repeat(72));
  if (total === 0) {
    console.log('  ✅ ALL MATCH — system matches physical count.');
  } else {
    console.log(`  ❌ ${total} MISMATCH(ES):\n`);
    [...fgIssues, ...rmIssues].forEach(i => {
      const tag = i.diff > 0 ? `system has ${i.diff} EXTRA` : `system is ${Math.abs(i.diff)} SHORT`;
      console.log(`    ${i.name}: ${tag}  (system=${i.actual}, physical=${i.physical})`);
    });
  }
  console.log('  ' + '='.repeat(72) + '\n');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
