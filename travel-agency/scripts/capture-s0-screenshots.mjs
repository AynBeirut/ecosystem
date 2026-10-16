#!/usr/bin/env node
/**
 * S0 builder screenshots (local dev, VITE_TRAVEL_DEMO=true).
 * Usage: VITE_TRAVEL_DEMO=true npm run dev  (separate terminal)
 *        node scripts/capture-s0-screenshots.mjs
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../team/builder-reports/assets');
const BASE = process.env.TRAVEL_SCREENSHOT_BASE || 'http://127.0.0.1:5175/travel';

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    sessionStorage.setItem('travelDemo', '1');
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/deals/d1/quote`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Quote builder' }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, 's0-quote-editor-empty.png'), fullPage: true });

  await page.goto(`${BASE}/deals/d1/quote/q1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Quote builder' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 's0-quote-editor-dubai-q1.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(OUT, 's0-quote-editor-dubai-q1-390w.png'), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/p/demo`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Dubai honeymoon').waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, 's0-public-proposal-demo.png'), fullPage: true });

  await browser.close();
  console.log('Screenshots written to', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
