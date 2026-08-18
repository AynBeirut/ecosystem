#!/usr/bin/env node
/**
 * Owner review — one row per RECIPE LINE per sell unit (matches handwritten cards).
 * Sub-products stay as named lines (e.g. Cashew Cheese Cream), not exploded.
 *
 *   node scripts/jinanPricingReview.cjs
 *   node scripts/exportJinanOwnerCostReview.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'jinan');

const CASHEW_GRAMS_PER_JAR = 250;
const ALMOND_GRAMS_PER_JAR = 250;
const SAUCE_GRAMS_PER_JAR = 250;
const LEMON_KG_PER_PIECE = 0.12;
const LEMON_SKU = 'JNK-MAT-00038';

const PACKAGING_SKUS = new Set([
  'JNK-MAT-00045', 'JNK-MAT-00049', 'JNK-MAT-00050', 'JNK-MAT-00052', 'JNK-MAT-00053',
]);

const OLD_TO_NAME = { 'JNK-MAT-00006': 'Lemon' };

const SELL_UNIT_RULES = {
  'JNK-PROD-00001': { type: 'nutPerJar', nutKgPerBatch: 0.6, nutGramsPerJar: CASHEW_GRAMS_PER_JAR, sellUnit: '1 jar (250g cashew)' },
  'JNK-PROD-00002': { type: 'nutPerJar', nutKgPerBatch: 0.5, nutGramsPerJar: ALMOND_GRAMS_PER_JAR, sellUnit: '1 jar (250g almond)' },
  'JNK-PROD-00003': { type: 'nutPerJar', nutKgPerBatch: 0.5, nutGramsPerJar: ALMOND_GRAMS_PER_JAR, sellUnit: '1 jar (250g almond)' },
  'JNK-PROD-00004': { type: 'gramsPerJar', batchGrams: 1780, sellUnit: '1 jar (250g sauce)' },
  'JNK-PROD-00005': { type: 'gramsPerJar', batchGrams: 1825, sellUnit: '1 jar (250g sauce)' },
  'JNK-PROD-00006': { type: 'fixed', units: 11, sellUnit: '1 cookie box (150g)' },
  'JNK-PROD-00007': { type: 'fixed', units: 12, sellUnit: '1 ice cream cup' },
  'JNK-PROD-00008': { type: 'fixed', units: 12, sellUnit: '1 ice cream cup' },
  'JNK-PROD-00009': { type: 'fixed', units: 1, sellUnit: '1 sundae' },
  'JNK-PROD-00010': { type: 'fixed', units: 1, sellUnit: '1 sundae' },
  'JNK-PROD-00011': { type: 'fixed', units: 8, sellUnit: '1 pizza dough portion (350g)' },
  'JNK-PROD-00012': { type: 'fixed', units: 4, sellUnit: '1 pizza sauce portion (1/4 batch)' },
  'JNK-PROD-00013': { type: 'fixed', units: 1, sellUnit: '1 pizza' },
  'JNK-PROD-00014': { type: 'fixed', units: 35, sellUnit: '1 empty croissant' },
  'JNK-PROD-00015': { type: 'fixed', units: 1, sellUnit: '1 almond croissant' },
  'JNK-PROD-00016': { type: 'fixed', units: 1, sellUnit: '1 date croissant' },
  'JNK-PROD-00017': { type: 'fixed', units: 1, sellUnit: '1 whole cake' },
  'JNK-PROD-00018': { type: 'fixed', units: 1, sellUnit: '1 foul plate' },
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
    return row;
  });
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function esc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function sellUnitsFor(sku) {
  const r = SELL_UNIT_RULES[sku];
  if (!r) return { units: 1, sellUnit: '1 unit' };
  if (r.type === 'nutPerJar') {
    return { units: (r.nutKgPerBatch * 1000) / r.nutGramsPerJar, sellUnit: r.sellUnit };
  }
  if (r.type === 'gramsPerJar') {
    return { units: r.batchGrams / SAUCE_GRAMS_PER_JAR, sellUnit: r.sellUnit };
  }
  return { units: r.units, sellUnit: r.sellUnit };
}

function oldSkuForMaterial(sku, matBySku) {
  const mat = matBySku[sku];
  if (!mat) return null;
  return Object.entries(OLD_TO_NAME).find(([, name]) => name.toLowerCase() === mat.name.toLowerCase())?.[0] || null;
}

function quantityInMaterialUnit(mat, recipeQty, oldSku) {
  let q = num(recipeQty);
  if (OLD_TO_NAME[oldSku] === 'Lemon' && q > 0 && q < 10) q *= LEMON_KG_PER_PIECE;
  const unit = (mat.unit || 'kg').toLowerCase();
  if (unit === 'gram' || unit === 'g') return q * 1000;
  return q;
}

function materialLineCost(matBySku, sku, recipeQty) {
  const mat = matBySku[sku];
  if (!mat) return { cost: 0, name: '?', qtyUsed: 0, unit: '' };
  const oldSku = oldSkuForMaterial(sku, matBySku);
  const qtyUsed = quantityInMaterialUnit(mat, recipeQty, oldSku);
  return {
    cost: qtyUsed * num(mat.costPerUnit),
    name: mat.name,
    qtyUsed,
    unit: mat.unit,
    costPerUnit: num(mat.costPerUnit),
  };
}

function outputMassKg(outputQuantity, outputUnit) {
  const q = num(outputQuantity) || 1;
  const u = (outputUnit || 'piece').toLowerCase();
  if (u === 'kg') return q;
  if (u === 'gram' || u === 'g') return q / 1000;
  return null;
}

/** Display qty as on recipe card (per one sold unit). Recipe CSV stores material qty in kg. */
function formatRecipeQty({ ingredientType, ingredientSku, recipeQtyPerUnit, materialName, matUnit, packagingQty }) {
  const q = num(recipeQtyPerUnit);
  const name = (materialName || '').toLowerCase();

  if (ingredientType === 'packaging' || PACKAGING_SKUS.has(ingredientSku)) {
    if (name.includes('bottle') || name.includes('jar')) return '1 pc';
    if (name.includes('box') || name.includes('lunch')) return '1 pc';
    return `${round4(packagingQty || 1)} pc`;
  }

  if (ingredientType === 'product') {
    if (q >= 1 && q < 10) return `${round4(q)} pc`;
    if (q >= 0.001) return `${round4(q * 1000)} g`;
    return `${round4(q)} batch`;
  }

  if (ingredientSku === LEMON_SKU || materialName === 'Lemon') {
    const pieces = q < 10 ? q : q / LEMON_KG_PER_PIECE;
    return `${round4(pieces)} pc`;
  }

  if ((name.includes('salt') || name.includes('vanilla') || name.includes('chili')) && q <= 0.002) {
    return 'pinch';
  }

  const u = (matUnit || 'kg').toLowerCase();
  if (u === 'liter' || name.includes('water')) {
    if (q >= 1) return `${round4(q)} liter`;
    return `${round4(q * 1000)} ml`;
  }
  if (u === 'piece') return `${round4(q)} pc`;

  // Recipe card weights are authored in kg (0.03 = 30 g)
  if (q >= 1) return `${round4(q)} kg`;
  return `${round4(q * 1000)} g`;
}

function lineLabel(row) {
  if (row.lineType === 'packaging') {
    const n = row.materialName.toLowerCase();
    if (n.includes('bottle') || n.includes('jar')) return 'jar';
    if (n.includes('box') || n.includes('lunch')) return 'box';
    return 'packaging';
  }
  return row.materialName;
}

function main() {
  const mats = parseCsv(fs.readFileSync(path.join(ROOT, 'raw_materials.csv'), 'utf8'));
  const matBySku = Object.fromEntries(mats.map((m) => [m.sku, m]));
  const prods = parseCsv(fs.readFileSync(path.join(ROOT, 'products.csv'), 'utf8')).filter((p) => p.name);
  const prodBySku = Object.fromEntries(prods.map((p) => [p.sku, p]));
  const recipes = parseCsv(fs.readFileSync(path.join(ROOT, 'recipe_ingredients.csv'), 'utf8'));
  const batchMemo = new Map();

  function batchRecipeLines(productSku, stack = new Set(), includePackaging = true) {
    const key = `${productSku}|${includePackaging ? 'full' : 'prod'}`;
    if (batchMemo.has(key)) return batchMemo.get(key);
    if (stack.has(productSku)) throw new Error(`Cycle ${productSku}`);
    stack.add(productSku);

    const lines = recipes.filter((r) => r.productSku === productSku);
    const head = lines[0] || {};
    const out = [];
    let total = 0;

    for (const r of lines) {
      if (!includePackaging && PACKAGING_SKUS.has(r.ingredientSku)) continue;

      if (r.ingredientType === 'product') {
        const sub = batchRecipeLines(r.ingredientSku, stack, false);
        const subLines = recipes.filter((x) => x.productSku === r.ingredientSku);
        const subHead = subLines[0] || {};
        const subOutUnit = (subHead.outputUnit || 'piece').toLowerCase();
        let fraction;
        if (subOutUnit === 'piece') {
          const subCount = num(subHead.outputQuantity) || 1;
          const q = num(r.quantity);
          fraction = q < 1 ? q : q / subCount;
        } else {
          const subMass = outputMassKg(subHead.outputQuantity, subHead.outputUnit);
          fraction = subMass ? num(r.quantity) / subMass : num(r.quantity);
        }
        const cost = round4(sub.total * fraction);
        total += cost;
        out.push({
          ingredientType: 'product',
          ingredientSku: r.ingredientSku,
          materialName: prodBySku[r.ingredientSku]?.name || r.ingredientSku,
          recipeQtyBatch: num(r.quantity),
          recipeQtyPerUnit: num(r.quantity),
          lineCostBatch: cost,
          lineType: 'sub-product',
        });
      } else {
        const line = materialLineCost(matBySku, r.ingredientSku, r.quantity);
        total += line.cost;
        out.push({
          ingredientType: 'material',
          ingredientSku: r.ingredientSku,
          materialName: line.name,
          recipeQtyBatch: num(r.quantity),
          recipeQtyPerUnit: num(r.quantity),
          matUnit: line.unit,
          lineCostBatch: round4(line.cost),
          lineType: PACKAGING_SKUS.has(r.ingredientSku) ? 'packaging' : 'raw material',
        });
      }
    }

    const result = { total: round2(total), lines: out, head };
    batchMemo.set(key, result);
    stack.delete(productSku);
    return result;
  }

  const detailRows = [];
  const summaryRows = [];

  for (const p of prods) {
    const { units, sellUnit } = sellUnitsFor(p.sku);
    const ownerPrice = num(p.price);
    let batch;
    try {
      batch = batchRecipeLines(p.sku, new Set(), true);
    } catch (e) {
      console.warn('Skip', p.sku, e.message);
      continue;
    }

    let totalCost = 0;
    for (const row of batch.lines) {
      const perUnitQty = round4(row.recipeQtyBatch / units);
      const perUnitCost = round4(row.lineCostBatch / units);
      totalCost += perUnitCost;

      const qtyDisplay = formatRecipeQty({
        ingredientType: row.lineType === 'packaging' ? 'packaging' : row.ingredientType,
        ingredientSku: row.ingredientSku,
        recipeQtyPerUnit: row.ingredientType === 'product'
          ? perUnitQty
          : perUnitQty,
        materialName: row.materialName,
        matUnit: row.matUnit,
        packagingQty: row.lineType === 'packaging' ? perUnitQty : undefined,
      });

      detailRows.push({
        productSku: p.sku,
        productName: p.name,
        category: p.category,
        sellUnit,
        sellUnitsPerBatch: units,
        materialSku: row.ingredientSku,
        materialName: row.materialName,
        lineType: row.lineType,
        qtyPerOneSoldUnit: perUnitQty,
        qtyDisplay,
        unit: row.matUnit || (row.ingredientType === 'product' ? 'product' : ''),
        lineCostPerSoldUnitUSD: perUnitCost,
      });
    }

    totalCost = round2(totalCost);
    summaryRows.push({
      productSku: p.sku,
      productName: p.name,
      sellUnit,
      sellUnitsPerBatch: units,
      totalIngredientCostUSD: totalCost,
      ownerListPriceUSD_reviewOnly: ownerPrice || '',
      marginUSD_reviewOnly: ownerPrice ? round2(ownerPrice - totalCost) : '',
      foodCostPct_reviewOnly: ownerPrice ? round2((totalCost / ownerPrice) * 100) : '',
      note: 'Quantities from recipe_ingredients.csv per sell unit — owner price for review only',
    });
  }

  const detailHeader = [
    'productSku', 'productName', 'category', 'sellUnit', 'sellUnitsPerBatch',
    'materialSku', 'materialName', 'lineType', 'qtyPerOneSoldUnit', 'qtyDisplay', 'unit',
    'lineCostPerSoldUnitUSD',
  ];
  const summaryHeader = [
    'productSku', 'productName', 'sellUnit', 'sellUnitsPerBatch',
    'totalIngredientCostUSD', 'ownerListPriceUSD_reviewOnly', 'marginUSD_reviewOnly',
    'foodCostPct_reviewOnly', 'note',
  ];

  fs.writeFileSync(
    path.join(ROOT, 'owner_cost_review_detail.csv'),
    [detailHeader.join(','), ...detailRows.map((r) => detailHeader.map((h) => esc(r[h])).join(','))].join('\n') + '\n',
  );
  fs.writeFileSync(
    path.join(ROOT, 'owner_cost_review_summary.csv'),
    [summaryHeader.join(','), ...summaryRows.map((r) => summaryHeader.map((h) => esc(r[h])).join(','))].join('\n') + '\n',
  );

  let md = `# Jinan's Kitchen — Owner Cost Review (recipe lines)\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `Each product lists **recipe card ingredients** scaled to one sell unit.\n\n`;
  md += `| Product | Sell unit | COGS | Owner price (review) |\n|---|---|---:|---:|\n`;
  for (const s of summaryRows) {
    md += `| ${s.productName} | ${s.sellUnit} | $${s.totalIngredientCostUSD} | $${s.ownerListPriceUSD_reviewOnly || '—'} |\n`;
  }
  fs.writeFileSync(path.join(ROOT, 'OWNER_COST_REVIEW.md'), md);

  console.log('Wrote jinan/owner_cost_review_detail.csv (recipe lines)');
  console.log('Wrote jinan/owner_cost_review_summary.csv');
  console.log('Wrote jinan/OWNER_COST_REVIEW.md');
  console.log(`Products: ${summaryRows.length} | Lines: ${detailRows.length}`);
}

main();
