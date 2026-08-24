#!/usr/bin/env node
/**
 * Sync Jinan's Kitchen V·POS menu — sale prices + always in stock.
 * Source: jinan/vpos_menu.csv (mirrored in reporting/data/)
 *
 *   node scripts/syncJinanVPosMenu.cjs
 *   node scripts/syncJinanVPosMenu.cjs --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const STORE_ID = 'ujff7blWYvUvlekQOrybvNCnn9V2';
const MENU_PATH = path.join(process.cwd(), 'jinan/vpos_menu.csv');
const REPORT_PATH = path.join(process.cwd(), 'reporting/data/jinan-vpos-menu-2026-08-23.csv');
const write = process.argv.includes('--write');

function nowIso() {
  return new Date().toISOString();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    values.push(current);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim();
    });
    return row;
  });
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bool(value, fallback = true) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return fallback;
  return v === 'true' || v === '1' || v === 'yes';
}

function buildDescription(row) {
  const parts = [row.description].filter(Boolean);
  if (row.servingSize) parts.push(row.servingSize);
  return parts.join(' · ');
}

async function main() {
  if (!fs.existsSync(MENU_PATH)) throw new Error(`Missing ${MENU_PATH}`);
  const rows = parseCsv(fs.readFileSync(MENU_PATH, 'utf8')).filter((row) => row.sku && row.name);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.copyFileSync(MENU_PATH, REPORT_PATH);

  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('serviceAccountKey.json not found');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();

  const existingSnap = await db.collection('products').where('storeId', '==', STORE_ID).get();
  const bySku = {};
  existingSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.sku) bySku[data.sku] = { id: docSnap.id, ref: docSnap.ref, data };
  });

  let created = 0;
  let updated = 0;
  const gaps = [];

  for (const row of rows) {
    const price = num(row.price);
    const description = buildDescription(row);
    const payload = {
      name: row.name,
      sku: row.sku,
      category: row.category || 'Other',
      description,
      icon: row.icon || '🍽️',
      price,
      sellingPrice: price,
      ownerReferencePrice: price,
      productType: 'composed',
      inStock: true,
      stock: 999,
      vposMenuVisible: bool(row.vposVisible, true),
      vposAlwaysAvailable: true,
      catalogDataStatus: row.dataStatus || 'menu-only',
      catalogDataNotes: row.notes || '',
      deliveryTime: '15 min',
      updatedAt: nowIso(),
    };

    if (row.dataStatus === 'menu-only') {
      gaps.push({ sku: row.sku, name: row.name, note: row.notes || 'Recipe pending' });
    }

    const existing = bySku[row.sku];
    if (existing) {
      console.log(`UPDATE ${row.sku} — ${row.name} — $${price} — vpos=${payload.vposMenuVisible}`);
      if (write) {
        await existing.ref.set(payload, { merge: true });
        const composedSnap = await db
          .collection('composedProducts')
          .where('storeId', '==', STORE_ID)
          .where('productId', '==', existing.id)
          .limit(1)
          .get();
        if (!composedSnap.empty) {
          await composedSnap.docs[0].ref.set(
            {
              sellingPrice: price,
              ownerReferencePrice: price,
              inStock: true,
              updatedAt: nowIso(),
            },
            { merge: true },
          );
        }
      }
      updated += 1;
      continue;
    }

    console.log(`CREATE ${row.sku} — ${row.name} — $${price} — vpos=${payload.vposMenuVisible}`);
    if (write) {
      const ref = db.collection('products').doc();
      await ref.set({
        ...payload,
        storeId: STORE_ID,
        recipeId: null,
        createdAt: nowIso(),
      });
      await db.collection('composedProducts').doc().set({
        productId: ref.id,
        name: row.name,
        category: row.category || 'Other',
        icon: row.icon || '🍽️',
        sellingPrice: price,
        ownerReferencePrice: price,
        costPrice: 0,
        serviceCost: 0,
        inStock: true,
        catalogDataStatus: row.dataStatus || 'menu-only',
        storeId: STORE_ID,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      bySku[row.sku] = { id: ref.id };
    }
    created += 1;
  }

  if (write) {
    for (const docSnap of existingSnap.docs) {
      await docSnap.ref.set(
        {
          inStock: true,
          vposAlwaysAvailable: true,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Menu rows: ${rows.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Created: ${created}`);
  console.log(`Menu-only / gaps: ${gaps.length}`);
  gaps.forEach((gap) => console.log(`  - ${gap.sku} ${gap.name}: ${gap.note}`));
  console.log(write ? 'Done.' : 'Dry-run — re-run with --write');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
