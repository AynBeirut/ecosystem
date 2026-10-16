import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve(
  '../screenshots/nextra-customer-facing-vardhantravels',
);
const CREDS_FILE = path.resolve(
  '../Customer-facing website (what your sub-a',
);

const credsText = fs.readFileSync(CREDS_FILE, 'utf8');
const userMatch = credsText.match(/Username:\s*(\S+)/);
const passMatch = credsText.match(/Password:\s*(\S+)/);
if (!userMatch || !passMatch) {
  console.error('Could not parse credentials from creds file');
  process.exit(1);
}
const username = userMatch[1];
const password = passMatch[1];

const ROUTES = [
  ['01-login', 'https://vardhantravels.nextra.travel/login', 'beforeAuth'],
  ['02-home', 'https://vardhantravels.nextra.travel/', 'auth'],
  ['03-flights', 'https://vardhantravels.nextra.travel/flights', 'auth'],
  ['04-activities', 'https://vardhantravels.nextra.travel/activities', 'auth'],
  ['05-cabs', 'https://vardhantravels.nextra.travel/cabs', 'auth'],
  ['06-hotels', 'https://vardhantravels.nextra.travel/hotels', 'auth'],
  ['07-group-tours', 'https://vardhantravels.nextra.travel/group-tours', 'auth'],
  ['08-account-wallet', 'https://vardhantravels.nextra.travel/account', 'auth'],
  ['09-my-booking', 'https://vardhantravels.nextra.travel/my-booking', 'auth'],
  ['10-wishlist', 'https://vardhantravels.nextra.travel/activities/wishlist', 'auth'],
  ['11-update-password', 'https://vardhantravels.nextra.travel/account/update-password', 'auth'],
  ['12-reports', 'https://vardhantravels.nextra.travel/reports', 'auth'],
  ['13-help', 'https://vardhantravels.nextra.travel/help', 'auth'],
  ['14-about', 'https://vardhantravels.nextra.travel/about', 'auth'],
  ['15-contact', 'https://vardhantravels.nextra.travel/contact', 'auth'],
  ['16-register', 'https://vardhantravels.nextra.travel/register', 'auth'],
  ['17-terms', 'https://vardhantravels.nextra.travel/terms', 'auth'],
  ['18-privacy', 'https://vardhantravels.nextra.travel/privacy', 'auth'],
  ['19-refunds', 'https://vardhantravels.nextra.travel/refunds', 'auth'],
];

fs.mkdirSync(OUT, { recursive: true });

async function screenshot(page, name) {
  await page.waitForTimeout(2500);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
}

async function login(page) {
  await page.goto('https://vardhantravels.nextra.travel/login', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.getByPlaceholder('e.g. acme.travels').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 60000,
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

let loggedIn = false;
for (const [name, url, mode] of ROUTES) {
  if (mode === 'beforeAuth') {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await screenshot(page, name);
    await login(page);
    loggedIn = true;
    continue;
  }
  if (mode === 'auth' && !loggedIn) {
    await login(page);
    loggedIn = true;
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await screenshot(page, name);
}

await browser.close();
console.log('done', OUT);
