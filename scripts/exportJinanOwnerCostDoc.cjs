#!/usr/bin/env node
/**
 * Owner review .doc (RTF — opens in Word)
 * Format:
 *   Product Name
 *   ingredient 250 g  $3.00
 *   jar 1 pc  $0.20
 *   product cost  $4.66
 *
 *   node scripts/jinanPricingReview.cjs
 *   node scripts/exportJinanOwnerCostReview.cjs
 *   node scripts/exportJinanOwnerCostDoc.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'jinan');
const OUT_DOC = path.join(ROOT, 'Jinan-Owner-Cost-Review.doc');
const OUT_RTF = path.join(ROOT, 'Jinan-Owner-Cost-Review.rtf');

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { values.push(cur); cur = ''; continue; }
      cur += ch;
    }
    values.push(cur);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
    return row;
  });
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return `$${num(v).toFixed(2)}`;
}

function rtfEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
}

function lineLabel(row) {
  if (row.lineType === 'packaging') {
    const n = row.materialName.toLowerCase();
    if (n.includes('bottle') || n.includes('jar')) return 'jar';
    if (n.includes('box')) return 'box';
    if (n.includes('lunch')) return 'box';
    return 'packaging';
  }
  return row.materialName;
}

function qtyLabel(row) {
  return row.qtyDisplay || `${row.qtyPerOneSoldUnit} ${row.unit}`;
}

function main() {
  const detail = parseCsv(fs.readFileSync(path.join(ROOT, 'owner_cost_review_detail.csv'), 'utf8'));
  const summary = parseCsv(fs.readFileSync(path.join(ROOT, 'owner_cost_review_summary.csv'), 'utf8'));

  const byProduct = new Map();
  for (const row of detail) {
    if (!byProduct.has(row.productSku)) byProduct.set(row.productSku, []);
    byProduct.get(row.productSku).push(row);
  }

  const blocks = [];
  blocks.push("{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\fs24");
  blocks.push("\\b Jinan's Kitchen — Product Cost Review\\b0\\par");
  blocks.push(`\\fs20 Generated ${new Date().toISOString().slice(0, 10)}\\par`);
  blocks.push("Ingredient lines follow recipe_ingredients.csv (one sell unit each).\\par");
  blocks.push("Owner list prices shown separately — not used in cost math.\\par\\par");

  for (const s of summary) {
    const lines = byProduct.get(s.productSku) || [];
    blocks.push(`\\b ${rtfEscape(s.productName)}\\b0\\par`);
    blocks.push(`\\i Sell unit: ${rtfEscape(s.sellUnit)}\\i0\\par`);
    blocks.push("\\par");

    const ingredients = lines.filter((r) => r.lineType !== 'packaging');
    const packaging = lines.filter((r) => r.lineType === 'packaging');

    for (const row of ingredients) {
      const label = lineLabel(row);
      const qty = qtyLabel(row);
      const cost = money(row.lineCostPerSoldUnitUSD);
      blocks.push(`${rtfEscape(label)}  ${rtfEscape(qty)}  ${rtfEscape(cost)}\\par`);
    }
    for (const row of packaging) {
      const label = lineLabel(row);
      const qty = qtyLabel(row);
      const cost = money(row.lineCostPerSoldUnitUSD);
      blocks.push(`${rtfEscape(label)}  ${rtfEscape(qty)}  ${rtfEscape(cost)}\\par`);
    }

    blocks.push(`\\b product cost  ${money(s.totalIngredientCostUSD)}\\b0\\par`);
    if (s.ownerListPriceUSD_reviewOnly) {
      blocks.push(`owner sell price (review only)  ${money(s.ownerListPriceUSD_reviewOnly)}\\par`);
    }
    blocks.push("\\par\\par");
  }

  blocks.push("}");

  const rtf = blocks.join('\n');
  fs.writeFileSync(OUT_RTF, rtf);
  fs.writeFileSync(OUT_DOC, rtf);

  console.log('Wrote', OUT_DOC);
  console.log('Wrote', OUT_RTF);
}

main();
