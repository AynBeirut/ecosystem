/* eslint-disable no-console */
/**
 * Audit paired POS devices vs store subscription status.
 * Run: node scripts/audit-pos-devices.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Missing serviceAccountKey.json at repo root');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'market-flow-7b074',
});

const db = admin.firestore();

function formatTs(value) {
  if (!value) return '—';
  const d = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString();
}

function subscriptionLabel(profile) {
  const status = profile?.subscriptionStatus;
  if (status === undefined || status === null || String(status).trim() === '') {
    return 'UNSET';
  }
  return String(status);
}

(async () => {
  console.log('\nPOS device audit — storeProfiles.subscriptionStatus\n');
  console.log('='.repeat(100));

  const deviceSnap = await db.collectionGroup('posDevices').get();
  console.log(`Paired devices found: ${deviceSnap.size}\n`);

  if (deviceSnap.empty) {
    console.log('No posDevices in Firestore. Nothing to audit.\n');
    process.exit(0);
  }

  const profileCache = new Map();
  const rows = [];

  for (const doc of deviceSnap.docs) {
    const storeId = doc.ref.parent.parent?.id || 'UNKNOWN';
    if (!profileCache.has(storeId)) {
      const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
      profileCache.set(storeId, profileSnap.exists ? profileSnap.data() : null);
    }
    const profile = profileCache.get(storeId);
    const data = doc.data();

    rows.push({
      storeId,
      storeName: profile?.storeName || profile?.businessName || '—',
      deviceId: doc.id,
      deviceName: data.deviceName || '—',
      platform: data.platform || '—',
      pairedAt: formatTs(data.pairedAt),
      lastSyncAt: formatTs(data.lastSyncAt),
      subscriptionStatus: subscriptionLabel(profile),
      subscriptionTier: profile?.subscriptionStatus ? profile?.subscriptionTier || '—' : profile?.subscriptionTier || '—',
      posModule: profile?.enabledModules?.pos === true ? 'yes' : 'no',
      isLegacyUser: profile?.isLegacyUser === true ? 'yes' : 'no',
      profileMissing: profile ? 'no' : 'YES',
    });
  }

  rows.sort((a, b) => {
    if (a.subscriptionStatus === 'UNSET' && b.subscriptionStatus !== 'UNSET') return -1;
    if (b.subscriptionStatus === 'UNSET' && a.subscriptionStatus !== 'UNSET') return 1;
    return a.storeId.localeCompare(b.storeId);
  });

  const unsetRows = rows.filter((r) => r.subscriptionStatus === 'UNSET');

  for (const r of rows) {
    const flag = r.subscriptionStatus === 'UNSET' ? ' *** UNSET ***' : '';
    console.log(
      [
        `storeId=${r.storeId}`,
        `storeName=${r.storeName}`,
        `deviceId=${r.deviceId}`,
        `deviceName=${r.deviceName}`,
        `platform=${r.platform}`,
        `pairedAt=${r.pairedAt}`,
        `lastSyncAt=${r.lastSyncAt}`,
        `subscriptionStatus=${r.subscriptionStatus}${flag}`,
        `subscriptionTier=${r.subscriptionTier}`,
        `posModule=${r.posModule}`,
        `isLegacyUser=${r.isLegacyUser}`,
        `profileMissing=${r.profileMissing}`,
      ].join(' | '),
    );
  }

  console.log('\n' + '='.repeat(100));
  console.log(`Total devices: ${rows.length}`);
  console.log(`Stores: ${profileCache.size}`);
  console.log(`UNSET subscriptionStatus: ${unsetRows.length}`);

  if (unsetRows.length > 0) {
    console.log('\n--- UNSET rows (fix before deploy) ---');
    for (const r of unsetRows) {
      console.log(`  ${r.storeId} | ${r.storeName} | device=${r.deviceId} (${r.deviceName})`);
    }
  } else {
    console.log('\nNo UNSET rows.');
  }

  console.log('');
  process.exit(unsetRows.length > 0 ? 2 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
