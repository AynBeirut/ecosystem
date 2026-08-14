#!/usr/bin/env node
/**
 * Register {slug}.grabio.space in Firebase Hosting for SSL (one cert per subdomain).
 * Run after backfillStoreSlugs or when a new store goes online.
 *
 * Usage: node scripts/registerStoreSubdomains.cjs
 *        node scripts/registerStoreSubdomains.cjs --online-only
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const ONLINE_ONLY = process.argv.includes('--online-only');
const SITE = 'market-flow-7b074';

function isFriendlySlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return false;
  if (!s.includes('-') && /^[a-z0-9]{20,32}$/.test(s)) return false;
  return true;
}

const sa = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.config/configstore/firebase-tools.json'), 'utf8'));
  const token = cfg.tokens?.access_token;
  if (!token) throw new Error('Firebase CLI token missing — run firebase login');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const listRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/domains`, { headers });
  const listData = await listRes.json();
  const existing = new Set((listData.domains || []).map((d) => d.domainName));

  const db = admin.firestore();
  let q = db.collection('storeProfiles');
  if (ONLINE_ONLY) q = q.where('status', '==', 'online');
  const snap = await q.get();

  for (const docSnap of snap.docs) {
    const slug = String(docSnap.data().slug || '').trim().toLowerCase();
    if (!isFriendlySlug(slug)) continue;
    const domain = `${slug}.grabio.space`;
    if (existing.has(domain)) {
      console.log(`skip ${domain}`);
      continue;
    }
    const res = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/domains`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ domainName: domain, site: SITE }),
    });
    const data = await res.json();
    if (data.error && data.error.code !== 409) {
      console.error(`fail ${domain}:`, data.error.message);
    } else {
      console.log(`registered ${domain} → ${data.provisioning?.certStatus || 'ok'}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  const final = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/domains`, { headers }).then((r) => r.json());
  console.log('\nStore subdomain certs:');
  for (const d of (final.domains || []).sort((a, b) => a.domainName.localeCompare(b.domainName))) {
    if (!d.domainName.endsWith('.grabio.space') || d.domainName === 'grabio.space' || d.domainName === 'www.grabio.space') continue;
    const p = d.provisioning || {};
    console.log(`  ${d.domainName}: ${p.certStatus} (${p.dnsStatus})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
