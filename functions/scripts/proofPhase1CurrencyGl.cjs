#!/usr/bin/env node
/**
 * Phase 1 runtime proof (Firestore emulator, zero prod touch).
 *
 * Exercises the REAL compiled backend posting service (functions/lib/...) to
 * prove that a store's base currency is stamped on the journal ENTRY and every
 * journal LINE. Run via:
 *   firebase emulators:exec --only firestore "node functions/scripts/proofPhase1CurrencyGl.cjs"
 */
const admin = require('firebase-admin');
const {
  postJournalEntry,
  ensureDefaultChartOfAccounts,
  accountsMap,
} = require('../lib/lib/ledger/postingService.js');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('❌ Refusing to run: FIRESTORE_EMULATOR_HOST not set (must run under the emulator).');
  process.exit(1);
}

admin.initializeApp({ projectId: 'demo-grabio-currency-proof' });
const db = admin.firestore();

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? '✅' : '❌'} ${label}: expected=${expected} actual=${actual}`);
}

async function proveStore({ storeId, profileCurrency, inputCurrency, expected }) {
  if (profileCurrency !== undefined) {
    await db.collection('storeProfiles').doc(storeId).set({ mainCurrency: profileCurrency });
  }
  const accounts = await ensureDefaultChartOfAccounts(storeId);
  const map = accountsMap(accounts);
  const [a, b] = accounts;

  const result = await postJournalEntry(
    {
      storeId,
      date: new Date().toISOString(),
      memo: 'Phase 1 currency proof',
      sourceType: 'proof',
      sourceId: `p1-${storeId}-${Date.now()}`,
      event: 'currency-stamp',
      ...(inputCurrency ? { currency: inputCurrency } : {}),
      lines: [
        { accountId: a.id, debit: 100, credit: 0, description: 'Dr proof' },
        { accountId: b.id, debit: 0, credit: 100, description: 'Cr proof' },
      ],
    },
    map,
  );

  const entrySnap = await db
    .collection('stores').doc(storeId)
    .collection('journalEntries').doc(result.entryId).get();
  const linesSnap = await db
    .collection('stores').doc(storeId)
    .collection('journalLines').where('entryId', '==', result.entryId).get();

  const entryCurrency = entrySnap.data().currency;
  const lineCurrencies = linesSnap.docs.map((d) => d.data().currency);

  console.log(`\n— store=${storeId} profile=${profileCurrency ?? '(none)'} input=${inputCurrency ?? '(none)'}`);
  check('entry.currency', entryCurrency, expected);
  lineCurrencies.forEach((c, i) => check(`line[${i}].currency`, c, expected));
  check('line count', lineCurrencies.length, 2);
}

async function main() {
  await proveStore({ storeId: 'store-lbp', profileCurrency: 'LBP', expected: 'LBP' });
  await proveStore({ storeId: 'store-usd', profileCurrency: 'USD', expected: 'USD' });
  await proveStore({ storeId: 'store-noprofile', profileCurrency: undefined, expected: 'USD' });
  await proveStore({ storeId: 'store-bad', profileCurrency: 'ZZZ', expected: 'USD' });
  await proveStore({ storeId: 'store-eur-override', profileCurrency: 'USD', inputCurrency: 'EUR', expected: 'EUR' });

  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
