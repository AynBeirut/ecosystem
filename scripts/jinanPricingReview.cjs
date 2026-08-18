#!/usr/bin/env node
/**
 * Jinan kitchen — trace recipes → materials → real cost per sell unit.
 * Prices validated against handwritten recipe cards in jinan/image data/recipies/
 *
 *   node scripts/jinanPricingReview.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'jinan');
const REPORT_DIR = path.join(__dirname, '..', 'reporting', 'data');

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

/** Handwritten recipe card prices — override CSV when they disagree */
const RECIPE_CARD_PRICES = {
  'JNK-MAT-00013': { packSize: '1 kg', packPriceUSD: '12', unit: 'kg', costPerUnit: '12', source: 'Almond Labni + Almond Cheese cards' },
  'JNK-MAT-00020': { packSize: '1 kg', packPriceUSD: '12', unit: 'kg', costPerUnit: '12', source: 'Cashew Cheese card' },
  'JNK-MAT-00031': { packSize: '10 kg', packPriceUSD: '45', unit: 'kg', costPerUnit: '4.5', source: 'Ice Cream Cookie card' },
  'JNK-MAT-00061': { packSize: '10 liter', packPriceUSD: '1.5', unit: 'liter', costPerUnit: '0.15', source: 'pack math' },
  'JNK-MAT-00062': { packSize: '100 gr', packPriceUSD: '10', unit: 'kg', costPerUnit: '100', source: '100g=$10 → $100/kg' },
  'JNK-MAT-00064': { packSize: '100 gr', packPriceUSD: '1', unit: 'kg', costPerUnit: '10', source: 'Dough card' },
  'JNK-MAT-00065': { packSize: '1 kg', packPriceUSD: '7', unit: 'kg', costPerUnit: '7', source: 'Strawberry Ice Cream card' },
  'JNK-MAT-00066': { packSize: '1 kg', packPriceUSD: '2.5', unit: 'kg', costPerUnit: '2.5', source: 'Ice cream cards' },
  'JNK-MAT-00067': { packSize: '1 kg', packPriceUSD: '10', unit: 'kg', costPerUnit: '10', source: 'Berries Ice Cream card' },
  'JNK-MAT-00017': { packSize: '1 kg', packPriceUSD: '4', unit: 'kg', costPerUnit: '4', source: 'Recipe cards' },
  'JNK-MAT-00018': { packSize: '950 gr', packPriceUSD: '14', unit: 'gram', costPerUnit: (14 / 950).toFixed(6), source: 'Croissant card' },
  'JNK-MAT-00021': { packSize: '1 kg', packPriceUSD: '17', unit: 'kg', costPerUnit: '17', source: 'Chocolate Sauce card' },
};

const CANONICAL_RECIPE = fs.readFileSync(path.join(ROOT, 'backups', 'recipe_ingredients-canonical.txt'), 'utf8');

/** Owner sell-unit rules — traced from recipe cards + Jinan sell practice */
const CASHEW_GRAMS_PER_JAR = 250; // 600g cashew batch → 2.4 jars
const ALMOND_GRAMS_PER_JAR = 250; // 500g almond batch → 2 jars; 250g @ $12/kg = $3 almond/jar
const SAUCE_GRAMS_PER_JAR = 250;

const SELL_UNIT_RULES = {
  // Nut spreads: each sold jar = 250g nut (NOT batch finished weight ÷ 250)
  'JNK-PROD-00001': { type: 'nutPerJar', nutKgPerBatch: 0.6, nutGramsPerJar: CASHEW_GRAMS_PER_JAR, name: 'Cashew Cheese Cream' },
  'JNK-PROD-00002': { type: 'nutPerJar', nutKgPerBatch: 0.5, nutGramsPerJar: ALMOND_GRAMS_PER_JAR, name: 'Almond Labni' },
  'JNK-PROD-00003': { type: 'nutPerJar', nutKgPerBatch: 0.5, nutGramsPerJar: ALMOND_GRAMS_PER_JAR, name: 'Almond Cheese' },
  // Sauces: 250g finished sauce per jar (batch weight ÷ 250)
  'JNK-PROD-00004': { type: 'gramsPerJar', batchGrams: 1780, name: 'Caramel Sauce' },
  'JNK-PROD-00005': { type: 'gramsPerJar', batchGrams: 1825, name: 'Chocolate Sauce' },
  // Ice cream cookie — recipe card: 11 boxes × 150g
  'JNK-PROD-00006': { type: 'fixed', units: 11, label: '150g cookie box (11/batch)' },
  // Ice cream — 1240g batch, 12 retail cups (craft box)
  'JNK-PROD-00007': { type: 'fixed', units: 12, label: 'ice cream cup (~103g)' },
  'JNK-PROD-00008': { type: 'fixed', units: 12, label: 'ice cream cup (~103g)' },
  'JNK-PROD-00009': { type: 'fixed', units: 1, label: '1 coco/caramel sundae' },
  'JNK-PROD-00010': { type: 'fixed', units: 1, label: '1 berries sundae' },
  // Dough — recipe card: 2800g batch, 350g/pizza → 8 pizzas
  'JNK-PROD-00011': { type: 'fixed', units: 8, label: '350g dough/pizza' },
  'JNK-PROD-00012': { type: 'fixed', units: 4, label: 'pizza sauce / 4 pies' },
  'JNK-PROD-00013': { type: 'fixed', units: 1, label: '1 pizza' },
  'JNK-PROD-00014': { type: 'fixed', units: 35, label: '1 empty croissant' },
  'JNK-PROD-00015': { type: 'fixed', units: 1, label: '1 almond croissant' },
  'JNK-PROD-00016': { type: 'fixed', units: 1, label: '1 date croissant' },
  'JNK-PROD-00017': { type: 'fixed', units: 1, label: 'whole cake 2540g' },
  'JNK-PROD-00018': { type: 'fixed', units: 1, label: '1 foul plate' },
};

function buildSellUnits() {
  const out = {};
  for (const [sku, rule] of Object.entries(SELL_UNIT_RULES)) {
    if (rule.type === 'nutPerJar') {
      const gramsPerJar = rule.nutGramsPerJar || CASHEW_GRAMS_PER_JAR;
      const units = (rule.nutKgPerBatch * 1000) / gramsPerJar;
      out[sku] = {
        units,
        label: `${gramsPerJar}g nut/jar (${rule.nutKgPerBatch * 1000}g nut/batch → ${units} jar(s))`,
      };
    } else if (rule.type === 'gramsPerJar') {
      const units = rule.batchGrams / SAUCE_GRAMS_PER_JAR;
      out[sku] = {
        units,
        label: `${SAUCE_GRAMS_PER_JAR}g sauce/jar (${rule.batchGrams}g batch → ${units} jars)`,
      };
    } else {
      out[sku] = { units: rule.units, label: rule.label };
    }
  }
  return out;
}

function buildPackagingByProduct(sellUnits) {
  const jar250 = (sku) => [{ sku: 'JNK-MAT-00045', qty: sellUnits[sku].units }];
  return {
    'JNK-PROD-00001': jar250('JNK-PROD-00001'),
    'JNK-PROD-00002': jar250('JNK-PROD-00002'),
    'JNK-PROD-00003': jar250('JNK-PROD-00003'),
    'JNK-PROD-00004': jar250('JNK-PROD-00004'),
    'JNK-PROD-00005': jar250('JNK-PROD-00005'),
    'JNK-PROD-00006': [{ sku: 'JNK-MAT-00049', qty: 11 }],
    'JNK-PROD-00007': [{ sku: 'JNK-MAT-00049', qty: 12 }],
    'JNK-PROD-00008': [{ sku: 'JNK-MAT-00049', qty: 12 }],
    'JNK-PROD-00009': [{ sku: 'JNK-MAT-00049', qty: 1 }],
    'JNK-PROD-00010': [{ sku: 'JNK-MAT-00049', qty: 1 }],
    'JNK-PROD-00017': [{ sku: 'JNK-MAT-00052', qty: 1 }, { sku: 'JNK-MAT-00053', qty: 1 }],
    'JNK-PROD-00018': [{ sku: 'JNK-MAT-00050', qty: 1 }],
  };
}

const SELL_UNITS = buildSellUnits();
const PACKAGING_BY_PRODUCT = buildPackagingByProduct(SELL_UNITS);
const PACKAGING_SKUS = new Set(
  Object.values(PACKAGING_BY_PRODUCT).flat().map((p) => p.sku),
);

const FOOD_COST_TARGET = 0.32;
const LEMON_KG_PER_PIECE = 0.12;

function parsePack(raw) {
  const original = String(raw || '').trim();
  const s = original.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return null;
  let m = s.match(/^([\d.]+)\s+sheets?\s*(?:\/\s*[\d.]+\s*(?:gr|g))?$/);
  if (m) return { qty: Number(m[1]), unit: 'piece', packLabel: original };
  m = s.match(/^([\d.]+)\s*(kg|kilos?|kgs)$/);
  if (m) return { qty: Number(m[1]), unit: 'kg', packLabel: original };
  m = s.match(/^([\d.]+)\s*(lit|liter|litre|l|lites)$/);
  if (m) return { qty: Number(m[1]), unit: 'liter', packLabel: original };
  m = s.match(/^([\d.]+)\s*(gr|g|gram|grams)$/);
  if (m) return { qty: Number(m[1]), unit: 'gram', packLabel: original };
  m = s.match(/^([\d.]+)\s*(ml)$/);
  if (m) return { qty: Number(m[1]), unit: 'ml', packLabel: original };
  m = s.match(/^([\d.]+)\s*(pc|pcs|piece|pieces|ball)$/);
  if (m) return { qty: Number(m[1]), unit: 'piece', packLabel: original };
  m = s.match(/^([\d.]+)(gr|g)$/);
  if (m) return { qty: Number(m[1]), unit: 'gram', packLabel: original };
  return null;
}

function recomputeCostFromPack(mat) {
  const price = num(mat.packPriceUSD);
  const pack = parsePack(mat.packSize);
  if (!pack || !price) return mat;
  const cpu = Number((price / pack.qty).toFixed(6));
  return { ...mat, unit: pack.unit, costPerUnit: String(cpu) };
}

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

function round2(n) {
  return Math.round(n * 100) / 100;
}

function applyRecipeCardPrices(matBySku) {
  for (const [sku, patch] of Object.entries(RECIPE_CARD_PRICES)) {
    if (!matBySku[sku]) continue;
    Object.assign(matBySku[sku], patch);
  }
}

function oldSkuForMaterial(sku, matBySku) {
  const mat = matBySku[sku];
  if (!mat) return null;
  return Object.entries(OLD_TO_NAME).find(([, name]) => name.toLowerCase() === mat.name.toLowerCase())?.[0] || null;
}

/** Recipe quantities are authored in kg (or L for liquids, or piece count for lemons). */
function quantityInMaterialUnit(mat, recipeQty, oldSku) {
  let q = num(recipeQty);
  const unit = (mat.unit || 'kg').toLowerCase();

  if (OLD_TO_NAME[oldSku] === 'Lemon' && q > 0 && q < 10) {
    q *= LEMON_KG_PER_PIECE;
  }

  switch (unit) {
    case 'kg':
      return q;
    case 'gram':
    case 'g':
      return q * 1000;
    case 'liter':
    case 'l':
      return q;
    case 'piece':
      return q;
    default:
      return q;
  }
}

function materialLineCost(matBySku, sku, recipeQty) {
  const mat = matBySku[sku];
  if (!mat) return { cost: 0, name: '?', qtyUsed: 0, unit: '' };
  const oldSku = oldSkuForMaterial(sku, matBySku);
  const qtyUsed = quantityInMaterialUnit(mat, recipeQty, oldSku);
  const cost = qtyUsed * num(mat.costPerUnit);
  return { cost, name: mat.name, qtyUsed, unit: mat.unit, costPerUnit: num(mat.costPerUnit) };
}

function main() {
  let mats = parseCsv(fs.readFileSync(path.join(ROOT, 'raw_materials.csv'), 'utf8')).filter((r) => r.name);
  const prods = parseCsv(fs.readFileSync(path.join(ROOT, 'products.csv'), 'utf8')).filter((r) => r.name);
  const nameToSku = Object.fromEntries(mats.map((m) => [m.name.toLowerCase(), m.sku]));
  const matBySku = Object.fromEntries(mats.map((m) => [m.sku, recomputeCostFromPack({ ...m })]));

  applyRecipeCardPrices(matBySku);

  const YIELD = 2.5;
  const dryFava = matBySku['JNK-MAT-00011'];
  const dryChick = matBySku['JNK-MAT-00001'];
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
  fs.writeFileSync(
    path.join(ROOT, 'raw_materials.csv'),
    toCsv(
      ['sku', 'name', 'packSize', 'packPriceUSD', 'unit', 'costPerUnit', 'currentStock', 'minimumThreshold', 'reorderPoint', 'storageLocation'],
      mats.filter((m) => m.name),
    ),
  );

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

  for (const [productSku, packs] of Object.entries(PACKAGING_BY_PRODUCT)) {
    const headLine = CANONICAL_RECIPE.trim().split(/\r?\n/).slice(1).find((l) => l.startsWith(`${productSku},`));
    const headParts = headLine ? headLine.split(',') : [];
    const outputQuantity = headParts[2] || '1';
    const outputUnit = headParts[3] || 'piece';
    const recipeName = headParts[1] || productSku;
    for (const pack of packs) {
      fixedLines.push(
        [productSku, recipeName, outputQuantity, outputUnit, 'material', pack.sku, pack.qty].join(','),
      );
    }
  }
  fs.writeFileSync(path.join(ROOT, 'recipe_ingredients.csv'), fixedLines.join('\n') + '\n');

  const recipes = parseCsv(fixedLines.join('\n'));
  const batchMemo = new Map();

  function outputMassKg(outputQuantity, outputUnit) {
    const q = num(outputQuantity) || 1;
    const u = (outputUnit || 'piece').toLowerCase();
    if (u === 'kg') return q;
    if (u === 'gram' || u === 'g') return q / 1000;
    return null;
  }

  function batchCostDetail(productSku, stack = new Set(), includePackaging = true) {
    const key = `${productSku}|${includePackaging ? 'full' : 'prod'}`;
    if (batchMemo.has(key)) return batchMemo.get(key);
    if (stack.has(productSku)) throw new Error(`Cycle: ${productSku}`);
    stack.add(productSku);

    const lines = recipes.filter((r) => r.productSku === productSku);
    const head = lines[0] || {};
    let total = 0;
    const ingredients = [];

    for (const r of lines) {
      if (!includePackaging && PACKAGING_SKUS.has(r.ingredientSku)) continue;

      if (r.ingredientType === 'product') {
        const sub = batchCostDetail(r.ingredientSku, stack, false);
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
        const cost = sub.total * fraction;
        total += cost;
        ingredients.push({
          type: 'product',
          sku: r.ingredientSku,
          name: prods.find((p) => p.sku === r.ingredientSku)?.name || r.ingredientSku,
          qty: r.quantity,
          cost: round2(cost),
        });
      } else {
        const line = materialLineCost(matBySku, r.ingredientSku, r.quantity);
        total += line.cost;
        ingredients.push({
          type: PACKAGING_SKUS.has(r.ingredientSku) ? 'packaging' : 'material',
          sku: r.ingredientSku,
          name: line.name,
          qty: r.quantity,
          qtyUsed: round2(line.qtyUsed),
          unit: line.unit,
          costPerUnit: line.costPerUnit,
          cost: round2(line.cost),
        });
      }
    }

    const result = {
      total: round2(total),
      output: `${head.outputQuantity} ${head.outputUnit}`,
      ingredients: ingredients.sort((a, b) => b.cost - a.cost),
    };
    batchMemo.set(key, result);
    stack.delete(productSku);
    return result;
  }

  const pricingRows = [];
  const breakdownProducts = [];

  function pricingDecision(costPerUnit, recommended, owner) {
    if (!owner || owner <= 0) {
      return { decision: 'NEED_OWNER_PRICE', note: 'Add price in products.csv' };
    }
    if (owner < recommended) {
      return { decision: 'BELOW_FLOOR', note: `Raise to ≥ $${recommended.toFixed(2)} (32% food-cost floor)` };
    }
    const foodCostPct = (costPerUnit / owner) * 100;
    if (foodCostPct <= 35) {
      return { decision: 'STRONG_MARGIN', note: foodCostPct <= 20 ? 'Healthy margin' : 'Good margin' };
    }
    if (foodCostPct <= 50) {
      return { decision: 'ACCEPTABLE', note: 'Above floor; OK for retail kitchen' };
    }
    return { decision: 'THIN_MARGIN', note: 'Review price or portions' };
  }

  for (const p of prods.filter((row) => row.name && row.sku)) {
    const detail = batchCostDetail(p.sku, new Set(), true);
    const production = batchCostDetail(p.sku, new Set(), false);
    const sell = SELL_UNITS[p.sku] || { units: 1, label: '1 unit' };
    const costPerSellUnit = detail.total / sell.units;
    const productionPerSellUnit = production.total / sell.units;
    const packagingPerSellUnit = costPerSellUnit - productionPerSellUnit;
    const recommended = Math.ceil((costPerSellUnit / FOOD_COST_TARGET) * 2) / 2;
    const owner = num(p.price);
    const { decision, note } = pricingDecision(costPerSellUnit, recommended, owner);

    pricingRows.push({
      sku: p.sku,
      name: p.name,
      category: p.category || '',
      batchCostUSD: detail.total.toFixed(2),
      productionBatchCostUSD: production.total.toFixed(2),
      sellUnit: sell.label,
      costPerUnitUSD: costPerSellUnit.toFixed(2),
      productionCostPerUnitUSD: productionPerSellUnit.toFixed(2),
      packagingCostPerUnitUSD: packagingPerSellUnit.toFixed(2),
      breakEvenPriceUSD: costPerSellUnit.toFixed(2),
      recommendedPriceUSD: recommended.toFixed(2),
      ownerEstimateUSD: owner ? owner.toFixed(2) : '',
      gapVsRecommendedUSD: owner ? (owner - recommended).toFixed(2) : '',
      ownerFoodCostPct: owner ? ((costPerSellUnit / owner) * 100).toFixed(1) + '%' : '',
      marginAtOwnerPct: owner ? (((owner - costPerSellUnit) / owner) * 100).toFixed(0) + '%' : '',
      decision,
      note,
    });

    breakdownProducts.push({
      sku: p.sku,
      name: p.name,
      batchOutput: detail.output,
      batchCostUSD: detail.total,
      productionBatchCostUSD: production.total,
      sellUnitsPerBatch: sell.units,
      sellUnitLabel: sell.label,
      costPerSellUnitUSD: round2(costPerSellUnit),
      productionCostPerSellUnitUSD: round2(productionPerSellUnit),
      packagingCostPerSellUnitUSD: round2(packagingPerSellUnit),
      floor32pctUSD: recommended,
      ownerPriceUSD: owner || null,
      foodCostPctAtOwner: owner ? round2((costPerSellUnit / owner) * 100) : null,
      ingredients: detail.ingredients,
    });
  }

  const headers = [
    'sku', 'name', 'category', 'batchCostUSD', 'productionBatchCostUSD', 'sellUnit',
    'costPerUnitUSD', 'productionCostPerUnitUSD', 'packagingCostPerUnitUSD',
    'breakEvenPriceUSD', 'recommendedPriceUSD', 'ownerEstimateUSD', 'gapVsRecommendedUSD',
    'ownerFoodCostPct', 'marginAtOwnerPct', 'decision', 'note',
  ];
  fs.writeFileSync(path.join(ROOT, 'pricing_review.csv'), toCsv(headers, pricingRows));

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    store: "Jinan's Kitchen",
    methodology: 'Recipe card prices + nested recipes (sub-products exclude jar/packaging) + packaging on final sell unit',
    foodCostTargetPct: FOOD_COST_TARGET * 100,
    recipeCardPriceFixes: RECIPE_CARD_PRICES,
    productCount: pricingRows.length,
    decisions: pricingRows.reduce((acc, r) => {
      acc[r.decision] = (acc[r.decision] || 0) + 1;
      return acc;
    }, {}),
    products: pricingRows,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'jinan-pricing-decision.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(REPORT_DIR, 'jinan-product-cost-breakdown.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), products: breakdownProducts }, null, 2),
  );

  // Human audit: every ingredient line per product
  const auditLines = ['productSku,productName,sellUnit,ingredientSku,ingredientName,recipeQty,usedQty,unit,costPerUnitUSD,lineCostUSD,lineType'];
  for (const p of breakdownProducts) {
    for (const ing of p.ingredients) {
      auditLines.push([
        p.sku,
        `"${p.name}"`,
        `"${p.sellUnitLabel}"`,
        ing.sku,
        `"${ing.name}"`,
        ing.qty,
        ing.qtyUsed ?? '',
        ing.unit ?? '',
        ing.costPerUnit ?? '',
        ing.cost,
        ing.type,
      ].join(','));
    }
  }
  fs.writeFileSync(path.join(ROOT, 'real_cost_audit.csv'), auditLines.join('\n') + '\n');

  const gasPer15Days = 55;
  fs.writeFileSync(
    path.join(ROOT, 'expenses.csv'),
    toCsv(['name', 'category', 'amountUSD', 'frequency', 'notes'], [{
      name: 'Cooking Gas (Gaz)',
      category: '613 Generator & Diesel Expense',
      amountUSD: gasPer15Days.toFixed(2),
      frequency: 'every 15 days',
      notes: `~$${(gasPer15Days * 2).toFixed(2)}/month — not in recipe COGS`,
    }]),
  );

  console.log('✅ Traced', pricingRows.length, 'products from recipe cards');
  console.log('Decisions:', summary.decisions);
  console.log('');
  for (const r of pricingRows) {
    console.log(
      `${r.sku} ${r.name}: COGS $${r.costPerUnitUSD} (food $${r.productionCostPerUnitUSD} + pack $${r.packagingCostPerUnitUSD}) | floor $${r.recommendedPriceUSD} | sell $${r.ownerEstimateUSD} | ${r.decision}`,
    );
  }
}

main();
