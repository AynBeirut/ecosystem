/**
 * Unit tests for storeCommerceGuard eligibility logic (no emulator).
 */
const path = require('path');

async function loadGuard() {
  const modPath = path.join(__dirname, '../functions/lib/services/storeCommerceGuard.js');
  try {
    return require(modPath);
  } catch {
    console.error('Run: npm run build --prefix functions');
    process.exit(1);
  }
}

async function main() {
  const { evaluateStoreCommerceEligibility } = await loadGuard();

  const cases = [
    {
      id: 'G1',
      label: 'missing storeId',
      profile: { subscriptionStatus: 'active' },
      storeId: '',
      expect: false,
      code: 'MISSING_STORE_ID',
    },
    {
      id: 'G2',
      label: 'missing profile',
      profile: null,
      storeId: 'store1',
      expect: false,
      code: 'STORE_NOT_FOUND',
    },
    {
      id: 'G3',
      label: 'demo store blocked',
      profile: { isDemo: true, subscriptionStatus: 'active' },
      storeId: 'demo1',
      expect: false,
      code: 'DEMO_STORE',
    },
    {
      id: 'G4',
      label: 'active store allowed',
      profile: { subscriptionStatus: 'active' },
      storeId: 'real1',
      expect: true,
      code: 'OK',
    },
    {
      id: 'G5',
      label: 'trial store allowed',
      profile: { subscriptionStatus: 'trial' },
      storeId: 'real2',
      expect: true,
      code: 'OK',
    },
    {
      id: 'G6',
      label: 'legacy store (no status) allowed',
      profile: {},
      storeId: 'legacy1',
      expect: true,
      code: 'OK',
    },
    {
      id: 'G7',
      label: 'expired store blocked',
      profile: { subscriptionStatus: 'expired' },
      storeId: 'exp1',
      expect: false,
      code: 'SUBSCRIPTION_INACTIVE',
    },
    {
      id: 'G9',
      label: 'grace_period store allowed (scheduler value)',
      profile: { subscriptionStatus: 'grace_period' },
      storeId: 'gracep1',
      expect: true,
      code: 'OK',
    },
  ];

  let failed = 0;
  console.log('\n=== storeCommerceGuard unit tests ===\n');
  for (const c of cases) {
    const result = evaluateStoreCommerceEligibility(c.profile, c.storeId);
    const pass = result.eligible === c.expect && result.code === c.code;
    if (!pass) failed += 1;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${c.id} ${c.label}`);
    if (!pass) {
      console.log(`       expected eligible=${c.expect} code=${c.code}`);
      console.log(`       got eligible=${result.eligible} code=${result.code} msg=${result.message}`);
    }
  }

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
