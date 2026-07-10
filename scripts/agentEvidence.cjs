const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { execFileSync } = require('child_process');

const PROJECT = 'market-flow-7b074';
const API = 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';
const API_KEY = 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U';

const STORE1 = 'EZfuoNQFTJVU4cubNuckpp4K7zw2'; // mooveelectro@gmail.com
const STORE2 = 'wZz0NNXXKyVXVuvoiPVYsb1P1OB3'; // indigo.commun@gmail.com

const sa = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: PROJECT,
  });
}

function curlJson(url, { method = 'GET', headers = {}, body } = {}) {
  const args = ['-sS', '--connect-timeout', '20', '-m', '120', '-X', method, url];
  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }
  if (body !== undefined) {
    args.push('-H', 'Content-Type: application/json');
    args.push('-d', JSON.stringify(body));
  }
  args.push('-w', '\n__HTTP_CODE__:%{http_code}');

  const output = execFileSync('curl', args, { encoding: 'utf8' });
  const marker = output.lastIndexOf('\n__HTTP_CODE__:');
  const text = output.slice(0, marker);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    httpCode: Number(output.slice(marker + 15).trim()),
    text,
    json,
  };
}

async function getIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const response = curlJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      body: {
        token: customToken,
        returnSecureToken: true,
      },
    },
  );
  if (response.httpCode !== 200 || !response.json?.idToken) {
    throw new Error(`Token exchange failed (${response.httpCode}): ${response.text}`);
  }
  return response.json.idToken;
}

async function main() {
  const token1 = await getIdToken(STORE1);
  const token2 = await getIdToken(STORE2);

  const tests = [
    {
      name: 'general_auto_1',
      token: token1,
      body: {
        storeId: STORE1,
        prompt: 'Give me a 5 bullet summary of my business health from available context.',
        skillMode: 'auto',
        modelMode: 'auto',
        context: { page: 'admin/dashboard' },
      },
    },
    {
      name: 'general_auto_2',
      token: token1,
      body: {
        storeId: STORE1,
        prompt: 'Draft a short weekly operations checklist for my store manager.',
        skillMode: 'auto',
        modelMode: 'auto',
        context: { page: 'admin/home' },
      },
    },
    {
      name: 'marketing_auto_1',
      token: token1,
      body: {
        storeId: STORE1,
        prompt: 'Create a Facebook ad copy and CTA for weekend offers targeting returning customers.',
        skillMode: 'auto',
        modelMode: 'auto',
        context: { page: 'admin/marketing/campaigns' },
      },
    },
    {
      name: 'marketing_auto_2',
      token: token1,
      body: {
        storeId: STORE1,
        prompt: 'Suggest 3 email subject lines to improve open rate for lapsed buyers.',
        skillMode: 'auto',
        modelMode: 'auto',
        context: { page: 'admin/marketing/email' },
      },
    },
    {
      name: 'finance_auto_1',
      token: token1,
      body: {
        storeId: STORE1,
        prompt: 'Review cash flow risk and provide 3 finance actions for next 30 days.',
        skillMode: 'auto',
        modelMode: 'auto',
        context: { page: 'admin/finance-suite' },
      },
    },
    {
      name: 'finance_auto_2',
      token: token1,
      body: {
        storeId: STORE1,
        prompt: 'Analyze receivables vs expenses and suggest margin-protection steps.',
        skillMode: 'auto',
        modelMode: 'auto',
        context: { page: 'admin/expenses' },
      },
    },
    {
      name: 'manual_override_claude_finance',
      token: token1,
      body: {
        storeId: STORE1,
        prompt: 'Provide concise financial controls for invoice collections this month.',
        skillMode: 'manual',
        skill: 'finance-consulting',
        modelMode: 'manual',
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-20250514',
        context: { page: 'admin/general' },
      },
    },
    {
      name: 'manual_override_gemini_marketing',
      token: token1,
      body: {
        storeId: STORE1,
        prompt: 'Write a Ramadan campaign idea with offer ladder and 2 ad variants.',
        skillMode: 'manual',
        skill: 'marketing',
        modelMode: 'manual',
        provider: 'gemini',
        modelId: 'gemini-2.5-flash',
        context: { page: 'admin/general' },
      },
    },
    {
      name: 'isolation_cross_tenant',
      token: token2,
      body: {
        storeId: STORE1,
        prompt: 'Should be blocked cross tenant',
        skillMode: 'auto',
        modelMode: 'auto',
        context: { page: 'admin/finance' },
      },
    },
  ];

  const results = [];
  for (const test of tests) {
    const response = curlJson(`${API}/agent/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${test.token}`,
      },
      body: test.body,
    });
    results.push({
      name: test.name,
      httpCode: response.httpCode,
      body: response.json || response.text,
    });
  }

  console.log(
    JSON.stringify(
      {
        api: API,
        store1: STORE1,
        store2: STORE2,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
