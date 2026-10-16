#!/usr/bin/env node
/**
 * One-time / repeatable seed for travel agency staging demo (Firebase Auth + Firestore).
 * Usage: node scripts/seedTravelAgencyDemo.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const PROJECT = 'market-flow-7b074';
const EMAIL = 'travel.demo@grabio.space';
const PASSWORD = 'TravelDemo2026!';
const UID = 'travelAgencyDemoOwner';
const STORE_ID = 'travel-agency-demo';

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: PROJECT });
}
const db = admin.firestore();
const auth = admin.auth();
const { buildDubaiHoneymoonDays, buildIstanbulFamilyDays, sumDays } = require('./travelAgencyDemoItinerary.cjs');

async function main() {
  try {
    await auth.getUser(UID);
    await auth.updateUser(UID, { email: EMAIL, password: PASSWORD, emailVerified: true });
    console.log('Updated auth user', EMAIL);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      await auth.createUser({ uid: UID, email: EMAIL, password: PASSWORD, emailVerified: true });
      console.log('Created auth user', EMAIL);
    } else throw e;
  }

  const now = new Date().toISOString();
  await db.doc(`stores/${STORE_ID}`).set(
    {
      ownerId: UID,
      name: 'Vardhan Travels (demo)',
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );

  await db.doc(`storeProfiles/${STORE_ID}`).set(
    {
      ownerId: UID,
      name: 'Vardhan Travels (demo)',
      storeName: 'Vardhan Travels (demo)',
      mainCurrency: 'INR',
      subscriptionStatus: 'trial',
      subscriptionTier: 'pro',
      isTestAccount: true,
      pricingVersion: 'modular-v2',
      startingPackage: 'pkg_invoice',
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );

  await db.doc(`users/${UID}`).set(
    {
      email: EMAIL,
      activeStoreId: STORE_ID,
      subAccountId: null,
      updatedAt: now,
    },
    { merge: true },
  );

  const contacts = [
    { id: 'demo-c1', name: 'Sharma family', phone: '+91 98765 43210' },
    { id: 'demo-c2', name: 'Ahmed Al-Rashid', email: 'ahmed@example.com', phone: '+971 50 000 0000' },
  ];
  for (const c of contacts) {
    await db.doc(`stores/${STORE_ID}/travelContacts/${c.id}`).set({ ...c, createdAt: now });
  }

  const deals = [
    {
      id: 'demo-d1',
      title: 'Dubai honeymoon — 4 pax',
      contactId: 'demo-c1',
      contactName: 'Sharma family',
      stage: 'quoted',
      destination: 'DXB',
      pax: 4,
      marginTotal: 12400,
    },
    {
      id: 'demo-d2',
      title: 'Goa weekend flights',
      contactId: 'demo-c2',
      contactName: 'Ahmed Al-Rashid',
      stage: 'deposit_received',
      destination: 'GOI',
      pax: 2,
      marginTotal: 3200,
    },
    {
      id: 'demo-d3',
      title: 'Istanbul family — 4 pax',
      contactId: 'demo-c1',
      contactName: 'Sharma family',
      stage: 'quoted',
      destination: 'IST',
      pax: 4,
      marginTotal: sumDays(buildIstanbulFamilyDays()).margin,
    },
  ];
  for (const d of deals) {
    await db.doc(`stores/${STORE_ID}/travelDeals/${d.id}`).set({
      ...d,
      assignedAgentId: UID,
      createdAt: now,
      updatedAt: now,
    });
  }

  const dubaiDays = buildDubaiHoneymoonDays();
  const dubaiTotals = sumDays(dubaiDays);
  const istanbulDays = buildIstanbulFamilyDays();
  const istanbulTotals = sumDays(istanbulDays);

  await db.doc(`stores/${STORE_ID}/travelQuotes/demo-q1`).set({
    dealId: 'demo-d1',
    quoteNumber: 'QT-2026-10-01-001',
    title: 'Dubai honeymoon — 4 pax',
    customerName: 'Sharma family',
    currency: 'INR',
    total: dubaiTotals.total,
    costTotal: dubaiTotals.costTotal,
    margin: dubaiTotals.margin,
    itinerary: 'Day 1: Arrive DXB, transfer to hotel\nDay 2–4: City + desert safari\nDay 5: Departure',
    days: dubaiDays,
    inclusions: '4★ hotel · Transfers · Desert safari',
    status: 'sent',
    createdAt: now,
    updatedAt: now,
  });

  await db.doc(`stores/${STORE_ID}/travelQuotes/demo-q2`).set({
    dealId: 'demo-d2',
    quoteNumber: 'QT-2026-09-28-002',
    title: 'Goa weekend — flights only',
    customerName: 'Ahmed Al-Rashid',
    currency: 'INR',
    total: 45000,
    costTotal: 41800,
    margin: 3200,
    itinerary: 'Fri: BOM → GOI morning\nSun: GOI → BOM evening',
    status: 'accepted',
    createdAt: now,
    updatedAt: now,
  });

  await db.doc(`stores/${STORE_ID}/travelQuotes/demo-q3`).set({
    dealId: 'demo-d3',
    quoteNumber: 'QT-2026-10-02-003',
    title: 'Istanbul family — 4 pax',
    customerName: 'Sharma family',
    currency: 'INR',
    total: istanbulTotals.total,
    costTotal: istanbulTotals.costTotal,
    margin: istanbulTotals.margin,
    itinerary: 'Five-day cultural itinerary with Bosphorus cruise.',
    days: istanbulDays,
    inclusions: 'Hotels · Tours · Transfers',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  });

  const activityRows = [
    { id: 'demo-a1', dealId: 'demo-d1', dealTitle: 'Dubai honeymoon — 4 pax', contactName: 'Sharma family', type: 'whatsapp', note: 'Sent quote link — awaiting reply' },
    { id: 'demo-a2', dealId: 'demo-d1', dealTitle: 'Dubai honeymoon — 4 pax', contactName: 'Sharma family', type: 'call', note: 'Discussed hotel upgrade options' },
    { id: 'demo-a3', dealId: 'demo-d2', dealTitle: 'Goa weekend flights', contactName: 'Ahmed Al-Rashid', type: 'meeting', note: 'Deposit received in office' },
    { id: 'demo-a4', dealId: 'demo-d3', dealTitle: 'Kerala group tour', contactName: 'Sharma family', type: 'email', note: 'Sent initial inquiry response' },
  ];
  for (const a of activityRows) {
    await db.doc(`stores/${STORE_ID}/travelActivities/${a.id}`).set({ ...a, createdAt: now, createdBy: UID });
  }

  const taskRows = [
    { id: 'demo-t1', dealId: 'demo-d1', dealTitle: 'Dubai honeymoon — 4 pax', contactName: 'Sharma family', title: 'Follow up — quote open 3 days', dueDate: '2026-10-02', status: 'open' },
    { id: 'demo-t2', dealId: 'demo-d2', dealTitle: 'Goa weekend flights', contactName: 'Ahmed Al-Rashid', title: 'Book BOM→GOI on Nextra', dueDate: '2026-10-01', status: 'open' },
    { id: 'demo-t3', dealId: 'demo-d3', dealTitle: 'Kerala group tour', contactName: 'Sharma family', title: 'Send first quotation', dueDate: '2026-10-03', status: 'open' },
  ];
  for (const t of taskRows) {
    await db.doc(`stores/${STORE_ID}/travelTasks/${t.id}`).set({ ...t, createdAt: now, createdBy: UID });
  }

  await db.doc(`stores/${STORE_ID}/travelSettings/nextra`).set({
    apiBaseUrl: 'https://api.nextra.travel',
    updatedAt: now,
  });

  await db.doc(`stores/${STORE_ID}/travelSettings/branding`).set({
    agencyName: 'Vardhan Travels (demo)',
    updatedAt: now,
  });

  console.log('Store ID:', STORE_ID);
  console.log('Login:', EMAIL);
  console.log('Password: (see .credentials.md Travel Agency staging demo)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
