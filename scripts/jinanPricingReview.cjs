#!/usr/bin/env node
/**
 * Fix Jinan recipe material SKUs (name remap), derive boiled-bean costs,
 * calculate product costs, write jinan/pricing_review.csv + jinan/expenses.csv
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'jinan');
const OLD_TO_NAME = {
  'JNK-MAT-00001': 'Cashew', 'JNK-MAT-00002': 'Agar', 'JNK-MAT-00003': 'Water', 'JNK-MAT-00004': 'Salt',
  'JNK-MAT-00005': 'Almond', 'JNK-MAT-00006': 'Lemon', 'JNK-MAT-00007': 'Apple Molasses', 'JNK-MAT-00008': 'Vanilla',
  'JNK-MAT-00009': 'Cacao', 'JNK-MAT-00010': 'Whole Wheat Flour', 'JNK-MAT-00011': 'Olive Oil', 'JNK-MAT-00012': 'Tahini',
  'JNK-MAT-00013': 'Yeast', 'JNK-MAT-00014': 'Starter', 'JNK-MAT-00015': 'Barley Flour', 'JNK-MAT-00016': 'Frozen Strawberry',
  'JNK-MAT-00017': 'Frozen Banana', 'JNK-MAT-00018': 'Frozen Mixed Berries', 'JNK-MAT-00019': 'Coconut Oil',
  'JNK-MAT-00020': 'Nutritional Yeast', 'JNK-MAT-00021': 'Fresh Tomatoes', 'JNK-MAT-00022': 'Pomegranate Sauce',
  'JNK-MAT-00023': 'Bicarbonate', 'JNK-MAT-00024': 'Lemon Zest', 'JNK-MAT-00025': 'Lemon Juice',
  'JNK-MAT-00026': 'Boiled Fava Beans', 'JNK-MAT-00027': 'Boiled Chickpeas', 'JNK-MAT-00028': 'Garlic',
  'JNK-MAT-00029': 'Chili Pepper', 'JNK-MAT-00030': 'Tahini Dates Ball',
};

const CANONICAL_RECIPE = fs.readFileSync(path.join(ROOT, 'backups', 'recipe_ingredients-canonical.txt'), 'utf8');

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

function toCsv(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n') + '\n';
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function main() {
  let mats = parseCsv(fs.readFileSync(path.join(ROOT, 'raw_materials.csv'), 'utf8')).filter((r) => r.name);
  const prods = parseCsv(fs.readFileSync(path.join(ROOT, 'products.csv'), 'utf8')).filter((r) => r.name);
  const nameToSku = Object.fromEntries(mats.map((m) => [m.name.toLowerCase(), m.sku]));
  const matBySku = Object.fromEntries(mats.map((m) => [m.sku, { ...m }]));

  // Derive boiled bean cost from dry (2.5x yield, no gas in recipe — gas is expense)
  const dryFava = matBySku['JNK-MAT-00011'];
  const dryChick = matBySku['JNK-MAT-00001'];
  const YIELD = 2.5;
  if (dryFava && matBySku['JNK-MAT-00072']) {
    matBySku['JNK-MAT-00072'].costPerUnit = (num(dryFava.costPerUnit) / YIELD).toFixed(4);
    matBySku['JNK-MAT-00072'].packPriceUSD = '';
    matBySku['JNK-MAT-00072'].packSize = `derived from ${dryFava.name}`;
  }
  if (dryChick && matBySku['JNK-MAT-00073']) {
    matBySku['JNK-MAT-00073'].costPerUnit = (num(dryChick.costPerUnit) / YIELD).toFixed(4);
    matBySku['JNK-MAT-00073'].packPriceUSD = '';
    matBySku['JNK-MAT-00073'].packSize = `derived from ${dryChick.name}`;
  }
  mats = Object.values(matBySku).sort((a, b) => a.sku.localeCompare(b.sku));
  fs.writeFileSync(path.join(ROOT, 'raw_materials.csv'), toCsv(
    ['sku', 'name', 'packSize', 'packPriceUSD', 'unit', 'costPerUnit', 'currentStock', 'minimumThreshold', 'reorderPoint', 'storageLocation'],
    mats.filter((m) => m.name),
  ));

  // Remap canonical recipe SKUs
  const fixedLines = ['productSku,recipeName,outputQuantity,outputUnit,ingredientType,ingredientSku,quantity'];
  for (const line of CANONICAL_RECIPE.trim().split(/\r?\n/).slice(1)) {
    const parts = line.split(',');
    const [productSku, recipeName, outputQuantity, outputUnit, ingredientType, ingredientSku, quantity] = parts;
    if (ingredientType === 'product') {
      fixedLines.push(line);
      continue;
    }
    const matName = OLD_TO_NAME[ingredientSku];
    const newSku = nameToSku[matName?.toLowerCase()];
    if (!newSku) throw new Error(`No material for ${matName} (${ingredientSku}) in ${productSku}`);
    fixedLines.push([productSku, recipeName, outputQuantity, outputUnit, ingredientType, newSku, quantity].join(','));
  }
  fs.writeFileSync(path.join(ROOT, 'recipe_ingredients.csv'), fixedLines.join('\n') + '\n');

  const recipes = parseCsv(fixedLines.join('\n'));
  const prodBySku = Object.fromEntries(prods.map((p) => [p.sku, p]));

  function materialUnitCost(sku, qty, oldSku) {
    const mat = matBySku[sku];
    if (!mat) return 0;
    let q = num(qty);
    const unit = (mat.unit || 'kg').toLowerCase();
    if (OLD_TO_NAME[oldSku] === 'Lemon' && q > 0 && q < 10) q *= 0.12;
    // Recipe lines use kg; some materials are priced per gram
    if (unit === 'gram' && q > 0 && q < 50) q *= 1000;
    if (unit === 'piece' && q > 0 && q < 3) q *= 1; // count
    return q * num(mat.costPerUnit);
  }

  const batchCostMemo = {};

  function outputQtyInKg(outputQuantity, outputUnit) {
    const q = num(outputQuantity) || 1;
    const u = (outputUnit || 'piece').toLowerCase();
    if (u === 'kg') return q;
    if (u === 'gram' || u === 'g') return q / 1000;
    return q; // piece — quantity is count fraction (e.g. 0.25 of 4-pizza sauce batch)
  }

  function batchCost(productSku, stack = new Set()) {
    if (batchCostMemo[productSku] != null) return batchCostMemo[productSku];
    if (stack.has(productSku)) throw new Error(`Cycle: ${productSku}`);
    stack.add(productSku);
    const lines = recipes.filter((r) => r.productSku === productSku);
    const head = lines[0] || {};
    let total = 0;
    for (const r of lines) {
      if (r.ingredientType === 'product') {
        const subBatch = batchCost(r.ingredientSku, stack);
        const subLines = recipes.filter((x) => x.productSku === r.ingredientSku);
        const subHead = subLines[0] || {};
        const subOutKg = outputQtyInKg(subHead.outputQuantity, subHead.outputUnit);
        const subOutUnit = (subHead.outputUnit || 'piece').toLowerCase();
        let fraction;
        if (subOutUnit === 'piece') {
          const subCount = num(subHead.outputQuantity) || 1;
          const q = num(r.quantity);
          fraction = q < 1 ? q : q / subCount;
        } else {
          fraction = num(r.quantity) / subOutKg;
        }
        total += subBatch * fraction;
      } else {
        const oldSku = Object.entries(OLD_TO_NAME).find(([, n]) => nameToSku[n.toLowerCase()] === r.ingredientSku)?.[0];
        total += materialUnitCost(r.ingredientSku, r.quantity, oldSku);
      }
    }
    batchCostMemo[productSku] = total;
    return total;
  }

  const SELL_UNITS = {
    'JNK-PROD-00001': { units: 7.6, label: '1900g batch ≈ 7.6×250g jars' },
    'JNK-PROD-00002': { units: 6, label: '1500g batch ≈ 6×250g jars' },
    'JNK-PROD-00003': { units: 8, label: '2000g batch = 8×250g jars' },
    'JNK-PROD-00004': { units: 7.12, label: '1780g batch ≈ 7×250g jars' },
    'JNK-PROD-00005': { units: 7.3, label: '1825g batch ≈ 7×250g jars' },
    'JNK-PROD-00006': { units: 11, label: '11 cookie boxes per batch' },
    'JNK-PROD-00007': { units: 12, label: '1240g ≈ 12 portions' },
    'JNK-PROD-00008': { units: 12, label: '1240g ≈ 12 portions' },
    'JNK-PROD-00009': { units: 1, label: '1 composed sundae unit' },
    'JNK-PROD-00010': { units: 1, label: '1 sundae' },
    'JNK-PROD-00011': { units: 8, label: '2800g dough = 8 pizzas OR 72 buns' },
    'JNK-PROD-00012': { units: 4, label: 'sauce batch = 4 pizzas' },
    'JNK-PROD-00013': { units: 1, label: '1 pizza' },
    'JNK-PROD-00014': { units: 35, label: '35 croissants per batch' },
    'JNK-PROD-00015': { units: 1, label: '1 croissant' },
    'JNK-PROD-00016': { units: 1, label: '1 croissant' },
    'JNK-PROD-00017': { units: 1, label: 'whole cake (2540g batch)' },
    'JNK-PROD-00018': { units: 1, label: '1 foul plate' },
  };

  const FOOD_COST_TARGET = 0.32;
  const pricingRows = [];

  function pricingDecision(costPerUnit, recommended, owner) {
    if (!owner || owner <= 0) {
      return { decision: 'NEED_OWNER_PRICE', note: 'Add owner estimate in products.csv price column' };
    }
    if (owner < recommended) {
      return {
        decision: 'BELOW_FLOOR',
        note: `Raise to at least $${recommended.toFixed(2)} (32% food-cost floor) or cut recipe cost`,
      };
    }
    const foodCostPct = (costPerUnit / owner) * 100;
    const ratio = owner / recommended;
    if (foodCostPct <= 35) {
      return {
        decision: 'STRONG_MARGIN',
        note: ratio >= 3
          ? 'Owner well above floor — premium OK; confirm sell unit matches batch split'
          : 'Owner above floor with strong margin',
      };
    }
    if (foodCostPct <= 50) {
      return { decision: 'ACCEPTABLE', note: 'Owner above floor; margin OK for kitchen retail' };
    }
    return {
      decision: 'THIN_MARGIN',
      note: 'Owner above floor but food cost high — review portions or price',
    };
  }

  for (const p of prods.filter((row) => row.name && row.sku)) {
    const batch = batchCost(p.sku);
    const sell = SELL_UNITS[p.sku] || { units: 1, label: '1 unit' };
    const costPerSellUnit = batch / sell.units;
    const recommended = Math.ceil((costPerSellUnit / FOOD_COST_TARGET) * 2) / 2;
    const owner = num(p.price);
    const gap = owner ? owner - recommended : null;
    const foodCostPctAtOwner = owner ? (costPerSellUnit / owner) * 100 : null;
    const { decision, note } = pricingDecision(costPerSellUnit, recommended, owner);

    pricingRows.push({
      sku: p.sku,
      name: p.name,
      category: p.category || '',
      batchCostUSD: batch.toFixed(2),
      sellUnit: sell.label,
      costPerUnitUSD: costPerSellUnit.toFixed(2),
      breakEvenPriceUSD: costPerSellUnit.toFixed(2),
      recommendedPriceUSD: recommended.toFixed(2),
      ownerEstimateUSD: owner ? owner.toFixed(2) : '',
      gapVsRecommendedUSD: gap != null ? gap.toFixed(2) : '',
      ownerFoodCostPct: foodCostPctAtOwner != null ? foodCostPctAtOwner.toFixed(1) + '%' : '',
      marginAtOwnerPct: owner ? (((owner - costPerSellUnit) / owner) * 100).toFixed(0) + '%' : '',
      ownerVsRecommendedRatio: owner && recommended ? (owner / recommended).toFixed(1) + 'x' : '',
      decision,
      note,
    });
  }

  const headers = [
    'sku', 'name', 'category', 'batchCostUSD', 'sellUnit', 'costPerUnitUSD', 'breakEvenPriceUSD',
    'recommendedPriceUSD', 'ownerEstimateUSD', 'gapVsRecommendedUSD', 'ownerFoodCostPct', 'marginAtOwnerPct',
    'ownerVsRecommendedRatio', 'decision', 'note',
  ];

  fs.writeFileSync(path.join(ROOT, 'pricing_review.csv'), toCsv(headers, pricingRows));

  const reportDir = path.join(__dirname, '..', 'reporting', 'data');
  fs.mkdirSync(reportDir, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    store: "Jinan's Kitchen",
    foodCostTargetPct: FOOD_COST_TARGET * 100,
    productCount: pricingRows.length,
    decisions: pricingRows.reduce((acc, r) => {
      acc[r.decision] = (acc[r.decision] || 0) + 1;
      return acc;
    }, {}),
    products: pricingRows,
  };
  fs.writeFileSync(
    path.join(reportDir, 'jinan-pricing-decision.json'),
    JSON.stringify(summary, null, 2),
  );

  // Gas as operating expense (not in recipes)
  const gasPer15Days = 55;
  const gasMonthly = (gasPer15Days * 2).toFixed(2);
  fs.writeFileSync(path.join(ROOT, 'expenses.csv'), toCsv(
    ['name', 'category', 'amountUSD', 'frequency', 'notes'],
    [{
      name: 'Cooking Gas (Gaz)',
      category: '613 Generator & Diesel Expense',
      amountUSD: gasPer15Days.toFixed(2),
      frequency: 'every 15 days',
      notes: `~$${gasMonthly}/month — operating expense, not allocated per recipe`,
    }],
  ));

  console.log('Wrote jinan/recipe_ingredients.csv (fixed SKUs)');
  console.log('Wrote jinan/pricing_review.csv');
  console.log('Wrote reporting/data/jinan-pricing-decision.json');
  console.log('Wrote jinan/expenses.csv');
  console.log('');
  console.log('Decision summary:', summary.decisions);
  console.log('');
  for (const r of pricingRows) {
    console.log(
      `${r.sku} ${r.name}: cost $${r.costPerUnitUSD} | floor $${r.recommendedPriceUSD} | owner $${r.ownerEstimateUSD} | ${r.decision}`,
    );
  }
}

main();
