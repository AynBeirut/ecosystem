/**
 * Notification test suite — seed Firestore + fire FCM for every Grabio notification type.
 *
 * Default store: NIPCO (y.malek@nip-lb.com)
 *
 * Usage:
 *   node scripts/notificationTestSuite.cjs --status
 *   node scripts/notificationTestSuite.cjs --list
 *   node scripts/notificationTestSuite.cjs --seed
 *   node scripts/notificationTestSuite.cjs --seed crm_visit_reminder,scheduled_order_1h
 *   node scripts/notificationTestSuite.cjs --fire new_order
 *   node scripts/notificationTestSuite.cjs --fire all --gap 8000
 *   node scripts/notificationTestSuite.cjs --real new_order
 *   node scripts/notificationTestSuite.cjs --real store_announcement
 *
 * Options:
 *   --store=STORE_ID
 *   --email=owner@example.com
 *   --gap=ms between --fire all (default 8000)
 *   --max-tokens=N  (default 3, latest devices only)
 *   --dry-run
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const TAG = 'notification-test-suite-v1';
const DEFAULT_STORE = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const DEFAULT_EMAIL = 'y.malek@nip-lb.com';
const BEIRUT_OFFSET = '+03:00';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const storeId = argv.find((a) => a.startsWith('--store='))?.split('=')[1] || DEFAULT_STORE;
const ownerEmail = argv.find((a) => a.startsWith('--email='))?.split('=')[1] || DEFAULT_EMAIL;
const gapMs = Number(argv.find((a) => a.startsWith('--gap='))?.split('=')[1] || 8000);
const maxTokens = Number(argv.find((a) => a.startsWith('--max-tokens='))?.split('=')[1] || 3);
const listMode = argv.includes('--list');
const statusMode = argv.includes('--status');
const seedArg = argv.find((a) => a.startsWith('--seed'));
const fireArg = argv.find((a) => a.startsWith('--fire'));
const realArg = argv.find((a) => a.startsWith('--real'));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function beirutIso(ymd, hour, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${ymd}T${hh}:${mm}:00${BEIRUT_OFFSET}`;
}

function tomorrowYmd() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const NOTIFICATIONS = {
  new_order: {
    label: 'New order (owner FCM)',
    channel: 'grabio_alerts',
    title: '🛒 New Order Received',
    body: '[TEST] A customer placed an order for USD 42.50',
    data: (ctx) => ({ type: 'new_order', storeId: ctx.storeId, orderId: ctx.testOrderId }),
  },
  order_confirmed: {
    label: 'Order confirmed (customer FCM)',
    channel: 'grabio_alerts',
    title: '✅ Order Confirmed',
    body: '[TEST] Order confirmed',
    data: (ctx) => ({ type: 'order_confirmed', orderId: ctx.testOrderId }),
  },
  order_preparing: {
    label: 'Order preparing',
    channel: 'grabio_alerts',
    title: '👨‍🍳 Order Being Prepared',
    body: '[TEST] Order is being prepared',
    data: (ctx) => ({ type: 'order_preparing', orderId: ctx.testOrderId }),
  },
  order_ready: {
    label: 'Order ready',
    channel: 'grabio_alerts',
    title: '🔔 Ready for Pickup',
    body: '[TEST] Order ready for pickup',
    data: (ctx) => ({ type: 'order_ready', orderId: ctx.testOrderId }),
  },
  order_delivered: {
    label: 'Order delivered',
    channel: 'grabio_alerts',
    title: '📦 Order Delivered',
    body: '[TEST] Order delivered',
    data: (ctx) => ({ type: 'order_delivered', orderId: ctx.testOrderId }),
  },
  order_cancelled: {
    label: 'Order cancelled',
    channel: 'grabio_alerts',
    title: '❌ Order Cancelled',
    body: '[TEST] Order cancelled',
    data: (ctx) => ({ type: 'order_cancelled', orderId: ctx.testOrderId }),
  },
  payment_paid: {
    label: 'Payment received (owner)',
    channel: 'grabio_alerts',
    title: '💳 Payment Received',
    body: '[TEST] Payment received for order',
    data: (ctx) => ({ type: 'payment_paid', storeId: ctx.storeId, orderId: ctx.testOrderId }),
  },
  payment_refunded: {
    label: 'Payment refunded (owner)',
    channel: 'grabio_alerts',
    title: '↩️ Payment Refunded',
    body: '[TEST] Refund issued',
    data: (ctx) => ({ type: 'payment_refunded', storeId: ctx.storeId, orderId: ctx.testOrderId }),
  },
  store_announcement: {
    label: 'Store announcement (favorites FCM)',
    channel: 'grabio_alerts',
    title: '📢 [TEST] Store announcement',
    body: 'Test announcement from notification suite',
    data: (ctx) => ({ type: 'store_announcement', storeId: ctx.storeId }),
  },
  low_stock: {
    label: 'Low stock alert',
    channel: 'grabio_alerts',
    title: '⚠️ Low Stock Alert (1 item)',
    body: '[TEST] Demo product is low: 2 units remaining',
    data: (ctx) => ({ type: 'low_stock', storeId: ctx.storeId }),
  },
  expiry_alert: {
    label: 'Expiry alert',
    channel: 'grabio_alerts',
    title: '⏳ Expiry alert',
    body: '[TEST] Demo product expires soon',
    data: (ctx) => ({ type: 'expiry_alert', storeId: ctx.storeId }),
  },
  scheduled_order_1h: {
    label: 'Scheduled order — 1 hour',
    channel: 'grabio_alerts',
    title: '⏰ Scheduled order in 1 hour',
    body: '[TEST] TEST-SCHED · Demo customer',
    data: (ctx) => ({ type: 'scheduled_order_1h', storeId: ctx.storeId, orderId: ctx.testOrderId }),
  },
  scheduled_order_30m: {
    label: 'Scheduled order — 30 minutes',
    channel: 'grabio_alerts',
    title: '🔔 Scheduled order in 30 minutes',
    body: '[TEST] TEST-SCHED · Demo customer',
    data: (ctx) => ({ type: 'scheduled_order_30m', storeId: ctx.storeId, orderId: ctx.testOrderId }),
  },
  crm_visit_reminder: {
    label: 'CRM visit reminder (assigned rep)',
    channel: 'grabio_assistant',
    title: '[TEST] Visit reminder',
    body: 'Hi — visit Demo CRM Client soon',
    data: (ctx) => ({
      type: 'crm_visit_reminder',
      storeId: ctx.storeId,
      customerId: ctx.testCustomerId || '',
      followUpAt: ctx.testFollowUpAt || '',
    }),
  },
  morning_briefing: {
    label: 'Morning work briefing',
    channel: 'grabio_assistant',
    title: '[TEST] Good morning',
    body: 'Your briefing: routes, tasks, and follow-ups for today',
    data: (ctx) => ({ type: 'morning_briefing', storeId: ctx.storeId }),
  },
  pending_approvals: {
    label: 'Pending approvals (mobile local — open app as manager)',
    channel: 'grabio_assistant',
    title: '[TEST] Orders need approval',
    body: 'You have pending orders waiting',
    data: (ctx) => ({ type: 'pending_approvals', storeId: ctx.storeId }),
  },
  crm_activity: {
    label: 'CRM visit logged (mobile local — manager app open)',
    channel: 'grabio_assistant',
    title: '[TEST] Visit logged',
    body: 'Jihan visited Demo CRM Client',
    data: (ctx) => ({ type: 'crm_activity', storeId: ctx.storeId, customerId: ctx.testCustomerId || '' }),
  },
};

async function resolveOwner(email) {
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) throw new Error(`No user for email ${email}`);
  const doc = snap.docs[0];
  return { uid: doc.id, data: doc.data() };
}

async function latestFcmTokens(userId, limit) {
  const snap = await db.collection('users').doc(userId).collection('fcmTokens').get();
  const rows = snap.docs.map((d) => ({
    token: d.id,
    updatedAt: d.data().updatedAt?.toDate?.() || new Date(0),
    platform: d.data().platform || '?',
    app: d.data().app || '?',
  }));
  rows.sort((a, b) => b.updatedAt - a.updatedAt);
  const unique = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.token)) continue;
    seen.add(row.token);
    unique.push(row);
    if (unique.length >= limit) break;
  }
  return unique;
}

async function sendPush(tokens, title, body, data, channel) {
  if (!tokens.length) return { ok: false, reason: 'no_tokens' };
  if (dryRun) {
    console.log(`  [dry-run] FCM → ${tokens.length} token(s): ${title}`);
    return { ok: true, dryRun: true };
  }
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    android: {
      priority: 'high',
      notification: { channelId: channel },
    },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  });
  return { ok: res.successCount > 0, success: res.successCount, failure: res.failureCount };
}

async function ensureTestOrder(ctx) {
  if (ctx.testOrderId) {
    const existing = await db.collection('orders').doc(ctx.testOrderId).get();
    if (existing.exists) return ctx.testOrderId;
  }
  const now = new Date().toISOString();
  const ref = await db.collection('orders').add({
    storeId: ctx.storeId,
    customerName: 'Notification Test Customer',
    customerEmail: 'notification-test@grabio.space',
    customerPhone: '+96170000000',
    status: 'pending',
    paymentStatus: 'unpaid',
    total: 42.5,
    currency: 'USD',
    items: [{ name: 'Test item', quantity: 1, price: 42.5 }],
    invoiceNumber: 'TEST-NOTIF',
    notes: TAG,
    createdAt: now,
    updatedAt: now,
  });
  ctx.testOrderId = ref.id;
  return ref.id;
}

async function seedAll(ctx) {
  const ymd = tomorrowYmd();
  const results = [];

  const orderRef = await db.collection('orders').add({
    storeId: ctx.storeId,
    customerName: 'Scheduled Test Customer',
    customerEmail: 'scheduled-test@grabio.space',
    status: 'confirmed',
    paymentStatus: 'unpaid',
    total: 99,
    currency: 'USD',
    items: [{ name: 'Scheduled item', quantity: 1, price: 99 }],
    invoiceNumber: 'TEST-SCHED',
    scheduledFor: beirutIso(ymd, 10, 0),
    scheduledReminder1hSentAt: null,
    scheduledReminder30mSentAt: null,
    notes: TAG,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  results.push({ kind: 'scheduled_order', orderId: orderRef.id, scheduledFor: beirutIso(ymd, 10, 0) });

  const order30Ref = await db.collection('orders').add({
    storeId: ctx.storeId,
    customerName: 'Scheduled 30m Customer',
    customerEmail: 'scheduled30-test@grabio.space',
    status: 'pending',
    paymentStatus: 'unpaid',
    total: 55,
    currency: 'USD',
    items: [{ name: 'Scheduled 30m', quantity: 1, price: 55 }],
    invoiceNumber: 'TEST-SCHED-30',
    scheduledFor: beirutIso(ymd, 9, 35),
    scheduledReminder1hSentAt: null,
    scheduledReminder30mSentAt: null,
    notes: TAG,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  results.push({ kind: 'scheduled_order_30m', orderId: order30Ref.id, scheduledFor: beirutIso(ymd, 9, 35) });

  const followUpAt = beirutIso(ymd, 9, 10);
  const custSnap = await db.collection('customers').where('storeId', '==', ctx.storeId).limit(1).get();
  let customerId;
  if (!custSnap.empty) {
    customerId = custSnap.docs[0].id;
    const patch = {
      nextFollowUpAt: new Date(followUpAt).toISOString(),
      assignedRepId: 'sub:pB5UbUYw06JHLRTnRftA',
      crmEnabled: true,
      updatedAt: new Date().toISOString(),
    };
    const reminderKey = `crmVisitReminderSent_${followUpAt.slice(0, 16)}`;
    patch[reminderKey] = admin.firestore.FieldValue.delete();
    await custSnap.docs[0].ref.set(patch, { merge: true });
  } else {
    const ref = await db.collection('customers').add({
      storeId: ctx.storeId,
      name: 'Demo CRM Client (notif test)',
      phone: '+96171111111',
      crmEnabled: true,
      assignedRepId: 'sub:pB5UbUYw06JHLRTnRftA',
      nextFollowUpAt: new Date(followUpAt).toISOString(),
      status: 'active',
      notes: TAG,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    customerId = ref.id;
  }
  ctx.testCustomerId = customerId;
  ctx.testFollowUpAt = new Date(followUpAt).toISOString();
  results.push({ kind: 'crm_visit_reminder', customerId, followUpAt });

  const prodSnap = await db.collection('products').where('storeId', '==', ctx.storeId).limit(1).get();
  if (!prodSnap.empty) {
    await prodSnap.docs[0].ref.set(
      {
        inStock: true,
        stock: 2,
        lowStockThreshold: 5,
        name: prodSnap.docs[0].data().name || 'Demo product',
        notes: TAG,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    results.push({ kind: 'low_stock', productId: prodSnap.docs[0].id });
  }

  await db.collection('users').doc(ctx.ownerUid).set(
    { assistantBriefingSentAt: admin.firestore.FieldValue.delete() },
    { merge: true },
  );
  results.push({ kind: 'morning_briefing_reset', userId: ctx.ownerUid, date: ymd });

  await db.collection('storeAnnouncements').add({
    storeId: ctx.storeId,
    title: '[TEST] Announcement seed',
    message: `Notification test seed for ${ymd} — favorites only`,
    notes: TAG,
    createdAt: new Date().toISOString(),
  });
  results.push({ kind: 'store_announcement_doc' });

  const activityRef = await db.collection('crmActivities').add({
    storeId: ctx.storeId,
    customerId,
    type: 'visit',
    result: 'interested',
    repId: 'sub:pB5UbUYw06JHLRTnRftA',
    repName: 'Jihan Sayegh',
    notes: `${TAG} — manager local alert test (create while y.malek app open)`,
    loggedAt: new Date().toISOString(),
    visitCompleted: true,
    createdBy: 'seed-script-not-jihan',
    source: 'crm',
    createdAt: new Date().toISOString(),
  });
  results.push({ kind: 'crm_activity_doc', activityId: activityRef.id });

  const logPath = path.join(__dirname, '../reporting/data', `notification-test-seed-${ymd}.json`);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(
    logPath,
    JSON.stringify({ storeId: ctx.storeId, ownerEmail, seededAt: new Date().toISOString(), results }, null, 2),
  );
  console.log(`Seed log: ${logPath}`);
  return results;
}

async function realTrigger(key, ctx) {
  if (key === 'new_order') {
    const id = await ensureTestOrder(ctx);
    console.log(`  Created order ${id} → onOrderCreated should FCM owner`);
    return;
  }
  if (key === 'store_announcement') {
    await db.collection('storeAnnouncements').add({
      storeId: ctx.storeId,
      title: '[TEST] Live announcement',
      message: 'Real Firestore trigger test — notification suite',
      notes: TAG,
      createdAt: new Date().toISOString(),
    });
    console.log('  Created storeAnnouncements doc → onStoreAnnouncement (favorites users only)');
    return;
  }
  if (key.startsWith('order_') || key.startsWith('payment_')) {
    const id = await ensureTestOrder(ctx);
    const ref = db.collection('orders').doc(id);
    const before = (await ref.get()).data();
    const patch = { updatedAt: new Date().toISOString() };
    if (key.startsWith('order_')) {
      patch.status = key.replace('order_', '');
    } else if (key === 'payment_paid') {
      patch.paymentStatus = 'paid';
    } else if (key === 'payment_refunded') {
      patch.paymentStatus = 'refunded';
    }
    await ref.update(patch);
    console.log(`  Updated order ${id} → onOrderStatusChanged (${key})`);
    return;
  }
  throw new Error(`--real not supported for ${key}. Use --fire or --seed.`);
}

async function fireOne(key, ctx, tokens) {
  const def = NOTIFICATIONS[key];
  if (!def) throw new Error(`Unknown notification: ${key}`);
  const data = def.data(ctx);
  const res = await sendPush(tokens.map((t) => t.token), def.title, def.body, data, def.channel);
  console.log(
    `  ${key}: ${res.ok ? 'sent' : 'FAILED'}`
    + (res.success != null ? ` (${res.success} ok, ${res.failure} fail)` : '')
    + (res.reason ? ` — ${res.reason}` : ''),
  );
  return res;
}

async function main() {
  const owner = await resolveOwner(ownerEmail);
  const ctx = {
    storeId,
    ownerUid: owner.uid,
    testOrderId: null,
    testCustomerId: null,
    testFollowUpAt: null,
  };

  if (listMode) {
    console.log('Notification types:\n');
    Object.entries(NOTIFICATIONS).forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${v.label}`));
    return;
  }

  const tokens = await latestFcmTokens(owner.uid, maxTokens);
  if (statusMode) {
    console.log(`Store: ${storeId}`);
    console.log(`Owner: ${ownerEmail} (${owner.uid})`);
    console.log(`FCM tokens (latest ${maxTokens}): ${tokens.length}`);
    tokens.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.platform}/${t.app} · ${t.token.slice(0, 28)}… · ${t.updatedAt.toISOString()}`);
    });
    console.log(`\nTomorrow seed date: ${tomorrowYmd()}`);
    return;
  }

  if (seedArg) {
    const keys = seedArg === '--seed'
      ? null
      : seedArg.split('=')[1]?.split(',').filter(Boolean);
    if (dryRun) {
      console.log('[dry-run] Would seed notification test data');
      return;
    }
    console.log(`Seeding notification test data for ${storeId}…`);
    const results = await seedAll(ctx);
    if (keys) {
      console.log('Filtered keys requested:', keys.join(', '));
    }
    results.forEach((r) => console.log(' ', JSON.stringify(r)));
    console.log('\nScheduler picks up (Beirut work hours):');
    console.log('  · scheduled_order_1h / 30m — every 5 min');
    console.log('  · crm_visit_reminder — every 5 min');
    console.log('  · morning_briefing — Mon–Sat 08:15');
    console.log('  · low_stock — daily 09:00 UTC');
    return;
  }

  if (realArg) {
    const key = realArg === '--real' ? 'new_order' : realArg.split('=')[1];
    const keys = key === 'all' ? ['new_order', 'store_announcement'] : [key];
    for (const k of keys) {
      console.log(`REAL ${k}:`);
      await realTrigger(k, ctx);
      if (keys.length > 1) await sleep(gapMs);
    }
    return;
  }

  if (fireArg) {
    const key = fireArg === '--fire' ? 'new_order' : fireArg.split('=')[1];
    const keys = key === 'all' ? Object.keys(NOTIFICATIONS) : [key];
    if (!tokens.length) {
      console.error('No FCM tokens — open grabio.space as y.malek and allow notifications first.');
      process.exit(1);
    }
    console.log(`Firing ${keys.length} notification(s) to ${tokens.length} token(s)…\n`);
    await ensureTestOrder(ctx);
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      console.log(`${k}:`);
      await fireOne(k, ctx, tokens);
      if (i < keys.length - 1) await sleep(gapMs);
    }
    console.log('\nDone. Check phone + browser notification tray.');
    return;
  }

  console.log('Use --status | --list | --seed | --fire <key> | --real <key>');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
