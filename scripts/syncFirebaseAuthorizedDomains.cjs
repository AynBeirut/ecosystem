#!/usr/bin/env node
/**
 * Merge Firebase Hosting preview channel hostnames into Identity Toolkit authorizedDomains.
 *
 *   node scripts/syncFirebaseAuthorizedDomains.cjs
 *   node scripts/syncFirebaseAuthorizedDomains.cjs --dry-run
 */
const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const { join } = require('path');
const { GoogleAuth } = require('google-auth-library');

const dryRun = process.argv.includes('--dry-run');
const projectId = 'market-flow-7b074';

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
const auth = new GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/identitytoolkit'],
});

function listPreviewHosts() {
  const out = execSync('firebase hosting:channel:list --json', { encoding: 'utf8' });
  const data = JSON.parse(out);
  const hosts = new Set();
  for (const ch of data.result?.channels || []) {
    const url = ch.url || '';
    try {
      hosts.add(new URL(url).hostname);
    } catch {
      /* skip */
    }
  }
  hosts.add('localhost');
  hosts.add('market-flow-7b074.firebaseapp.com');
  hosts.add('market-flow-7b074.web.app');
  hosts.add('grabio.space');
  hosts.add('www.grabio.space');
  return [...hosts].sort();
}

async function main() {
  const client = await auth.getClient();
  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const current = await client.request({ url: configUrl });
  const existing = current.data.authorizedDomains || [];
  const desired = listPreviewHosts();
  const merged = [...new Set([...existing, ...desired])].sort();
  const added = merged.filter((d) => !existing.includes(d));

  console.log('Existing authorized domains:', existing.length);
  if (added.length) console.log('Will add:', added);
  else console.log('No new domains to add.');

  if (dryRun || !added.length) return;

  await client.request({
    url: configUrl,
    method: 'PATCH',
    data: { authorizedDomains: merged },
  });
  console.log('Updated authorizedDomains (' + merged.length + ' total).');
  console.log(
    '\nIf Google sign-in still fails on preview URLs, add each origin under GCP OAuth Web client:',
    'https://console.cloud.google.com/apis/credentials?project=' + projectId,
  );
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
