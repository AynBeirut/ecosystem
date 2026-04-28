/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function looksLiveValue(value) {
  const text = String(value || '').trim();
  return text.length >= 4 && !/(sandbox|test|demo)/i.test(text);
}

function isPaid(order) {
  return String(order.paymentStatus || '').toLowerCase() === 'paid';
}

function isFailed(order) {
  const status = String(order.paymentStatus || '').toLowerCase();
  return status === 'failed' || status === 'payment_failed' || status === 'canceled';
}

function hasFinalizationMarker(order) {
  return Boolean(order.inventoryDeductedAt) || Boolean(order.paidAt) || Boolean(order.paymentDate);
}

function hasWhishCallbackUrls(order) {
  return Boolean(order.whishSuccessCallbackUrl) && Boolean(order.whishFailureCallbackUrl);
}

function hasWhishGateway(order) {
  const gateway = String(order.paymentGateway || order.gateway || order.paymentMethod || '').toLowerCase();
  return gateway === 'whish';
}

function scoreToStatus(pct) {
  if (pct >= 90) return 'PASS';
  if (pct >= 70) return 'WARN';
  return 'FAIL';
}

(async () => {
  const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('Missing serviceAccountKey.json at repo root.');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const db = admin.firestore();
  const nowIso = new Date().toISOString();

  const storesSnap = await db.collection('storeProfiles').get();
  const stores = storesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

  const whishStores = stores.filter((store) => {
    const channel = String(store.whishChannel || '').trim();
    const secret = String(store.whishSecret || '').trim();
    const websiteUrl = String(store.websiteUrl || '').trim();
    return Boolean(channel && secret && websiteUrl);
  });

  const lines = [];
  lines.push('# Whish Callback & Finalization Validation Report');
  lines.push('');
  lines.push(`Generated at: ${nowIso}`);
  lines.push(`Project: ${serviceAccount.project_id}`);
  lines.push(`Stores scanned: ${stores.length}`);
  lines.push(`Stores with Whish credentials: ${whishStores.length}`);
  lines.push('');

  let overallPassCount = 0;

  for (const store of whishStores) {
    const storeId = store.id;
    const channel = String(store.whishChannel || '').trim();
    const secret = String(store.whishSecret || '').trim();
    const websiteUrl = String(store.websiteUrl || '').trim();

    const ordersSnap = await db.collection('orders').where('storeId', '==', storeId).limit(500).get();
    const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

    const whishOrders = orders.filter(hasWhishGateway);
    const paidWhishOrders = whishOrders.filter(isPaid);
    const failedWhishOrders = whishOrders.filter(isFailed);
    const finalizedPaidOrders = paidWhishOrders.filter(hasFinalizationMarker);
    const callbackReadyOrders = whishOrders.filter(hasWhishCallbackUrls);

    const checks = [
      {
        id: 'credentials_present',
        pass: Boolean(channel && secret && websiteUrl),
        detail: channel && secret && websiteUrl
          ? 'Channel, secret, and website URL are configured.'
          : 'Missing one or more required Whish credentials.',
      },
      {
        id: 'credentials_live_like',
        pass: looksLiveValue(channel) && looksLiveValue(secret),
        detail: looksLiveValue(channel) && looksLiveValue(secret)
          ? 'Credentials do not match sandbox/test patterns.'
          : 'Credential text still looks like sandbox/test/demo.',
      },
      {
        id: 'whish_paid_orders_exist',
        pass: paidWhishOrders.length > 0,
        detail: paidWhishOrders.length > 0
          ? `${paidWhishOrders.length} paid Whish order(s) found.`
          : 'No paid Whish orders found yet.',
      },
      {
        id: 'paid_orders_finalized',
        pass: paidWhishOrders.length > 0 && finalizedPaidOrders.length === paidWhishOrders.length,
        detail: paidWhishOrders.length === 0
          ? 'No paid Whish orders to validate finalization.'
          : `${finalizedPaidOrders.length}/${paidWhishOrders.length} paid Whish order(s) have finalization markers.`,
      },
      {
        id: 'callback_urls_recorded',
        pass: whishOrders.length > 0 && callbackReadyOrders.length === whishOrders.length,
        detail: whishOrders.length === 0
          ? 'No Whish orders found to validate callback URL persistence.'
          : `${callbackReadyOrders.length}/${whishOrders.length} Whish order(s) include success/failure callback URLs.`,
      },
      {
        id: 'failure_path_observed',
        pass: failedWhishOrders.length > 0,
        detail: failedWhishOrders.length > 0
          ? `${failedWhishOrders.length} failed/canceled Whish order(s) found.`
          : 'No failed/canceled Whish orders found yet.',
      },
    ];

    const passed = checks.filter((check) => check.pass).length;
    const scorePct = checks.length > 0 ? Math.round((passed / checks.length) * 100) : 0;
    const status = scoreToStatus(scorePct);
    if (status === 'PASS') overallPassCount += 1;

    lines.push(`## Store ${storeId}`);
    lines.push('');
    lines.push(`Status: ${status}`);
    lines.push(`Score: ${passed}/${checks.length} (${scorePct}%)`);
    lines.push(`Whish orders scanned: ${whishOrders.length}`);
    lines.push(`Paid Whish orders: ${paidWhishOrders.length}`);
    lines.push(`Failed Whish orders: ${failedWhishOrders.length}`);
    lines.push('');
    lines.push('| Check | Result | Detail |');
    lines.push('| --- | --- | --- |');
    for (const check of checks) {
      lines.push(`| ${check.id} | ${check.pass ? 'PASS' : 'WARN'} | ${check.detail} |`);
    }
    lines.push('');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`Stores passing validation: ${overallPassCount}/${whishStores.length}`);

  const reportsDir = path.resolve(__dirname, '../../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[.:]/g, '-');
  const reportPath = path.join(reportsDir, `whish-callback-finalization-report-${ts}.md`);
  fs.writeFileSync(reportPath, lines.join('\n'));

  console.log(`Validation report written: ${reportPath}`);
  console.log(`Stores passing validation: ${overallPassCount}/${whishStores.length}`);

  if (overallPassCount === 0 && whishStores.length > 0) {
    process.exitCode = 2;
  }
})();
