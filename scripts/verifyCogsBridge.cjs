/**
 * Compare Invoice Manager COGS (old vs bridged) against platform order COGS
 * for one store. Read-only — no writes.
 *
 * Usage: node scripts/verifyCogsBridge.cjs [storeId]
 */
const admin = require('firebase-admin');
const path = require('path');

const storeId = process.argv[2] || 'EZfuoNQFTJVU4cubNuckpp4K7zw2';

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

function resolveOrderItemProductKey(item) {
  return item.productId || item.composedProductId || item.id || null;
}

function buildFgCostMap(fgDocs) {
  const map = {};
  for (const doc of fgDocs) {
    const data = doc.data();
    const productId = data.productId || data.composedProductId;
    const cost = Number(data.costPrice || 0);
    if (productId && cost > 0) map[productId] = cost;
  }
  return map;
}

function resolvePlatformUnitCost(productId, product, fgCostMap) {
  const fgCost = fgCostMap[productId] || 0;
  const productCost = Number(product?.costPrice || 0);
  const serviceCost = Number(product?.serviceCost || 0);
  return Math.max(0, fgCost || productCost || serviceCost);
}

function overlayProducts(productDocs, fgCostMap) {
  return productDocs.map((doc) => {
    const data = doc.data();
    const platformCost = resolvePlatformUnitCost(doc.id, data, fgCostMap);
    const rawPrice = data.costPrice != null ? Number(data.costPrice) : undefined;
    return {
      id: doc.id,
      name: data.name || '',
      rawPrice: platformCost > 0 ? platformCost : rawPrice,
      financeRawPrice: rawPrice,
      fgCost: fgCostMap[doc.id] || 0,
    };
  });
}

async function loadFinanceInvoices(storeId) {
  const snap = await db.collection('stores').doc(storeId).collection('financeInvoices').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function main() {
  console.log(`\n=== COGS bridge verification — store ${storeId} ===\n`);

  const [fgSnap, productsSnap, ordersSnap, invoices] = await Promise.all([
    db.collection('finishedGoodsInventory').where('storeId', '==', storeId).get(),
    db.collection('products').where('storeId', '==', storeId).get(),
    db.collection('orders').where('storeId', '==', storeId).get(),
    loadFinanceInvoices(storeId),
  ]);

  const fgCostMap = buildFgCostMap(fgSnap.docs);
  const products = overlayProducts(productsSnap.docs, fgCostMap);
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));

  console.log(`FG items: ${fgSnap.size}, products: ${productsSnap.size}, orders: ${ordersSnap.size}, finance invoices: ${invoices.length}`);

  // Platform COGS from delivered orders (AdminRevenue pattern)
  let platformCogsTotal = 0;
  const platformLineSamples = [];

  ordersSnap.forEach((doc) => {
    const order = doc.data();
    if (order.status !== 'delivered') return;
    const items = order.items || [];
    items.forEach((item) => {
      const productId = resolveOrderItemProductKey(item);
      if (!productId) return;
      const qty = Number(item.quantity || 0);
      const unitCost = resolvePlatformUnitCost(productId, productById[productId], fgCostMap);
      const lineCogs = qty * unitCost;
      platformCogsTotal += lineCogs;
      if (platformLineSamples.length < 5 && lineCogs > 0) {
        platformLineSamples.push({
          orderId: doc.id,
          productId,
          name: productById[productId]?.name || productId,
          qty,
          unitCost,
          lineCogs,
        });
      }
    });
  });

  // IM COGS — old vs new on paid finance invoices
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  let imCogsOld = 0;
  let imCogsNew = 0;
  const mismatchLines = [];

  paidInvoices.forEach((invoice) => {
    const items = invoice.lineItems || invoice.items || [];
    items.forEach((item) => {
      const productId = item.id || item.productId;
      const product = productById[productId];
      const qty = Number(item.quantity || 0);
      const oldUnit = Number(item.rawPrice || product?.financeRawPrice || 0);
      const newUnit = Number(product?.rawPrice ?? item.rawPrice ?? 0);
      const oldLine = oldUnit * qty;
      const newLine = newUnit * qty;
      imCogsOld += oldLine;
      imCogsNew += newLine;
      if (Math.abs(oldLine - newLine) > 0.001 && mismatchLines.length < 10) {
        mismatchLines.push({
          invoiceId: invoice.id,
          productId,
          name: product?.name || item.description,
          qty,
          oldUnit,
          newUnit,
          oldLine,
          newLine,
          delta: newLine - oldLine,
        });
      }
    });
  });

  // Per delivered order: IM old vs platform FG cost (when no finance invoices exist)
  let orderOldCogs = 0;
  let orderNewCogs = 0;
  let sampleOrder = null;

  ordersSnap.forEach((doc) => {
    const order = doc.data();
    if (order.status !== 'delivered') return;
    let oldLine = 0;
    let newLine = 0;
    (order.items || []).forEach((item) => {
      const productId = resolveOrderItemProductKey(item);
      if (!productId) return;
      const qty = Number(item.quantity || 0);
      const product = productById[productId];
      const oldUnit = Number(product?.financeRawPrice || item.rawPrice || 0);
      const newUnit = resolvePlatformUnitCost(productId, product, fgCostMap);
      oldLine += oldUnit * qty;
      newLine += newUnit * qty;
    });
    orderOldCogs += oldLine;
    orderNewCogs += newLine;
    if (!sampleOrder && newLine > 0 && Math.abs(oldLine - newLine) > 0.01) {
      sampleOrder = { orderId: doc.id, oldLine, newLine, items: order.items };
    }
  });

  console.log('\n--- Delivered orders: stale product.costPrice vs FG cost ---');
  console.log(`Order COGS OLD (products.costPrice):  $${orderOldCogs.toFixed(2)}`);
  console.log(`Order COGS NEW (FG weighted avg):    $${orderNewCogs.toFixed(2)}`);
  console.log(`Delta:                               $${(orderNewCogs - orderOldCogs).toFixed(2)}`);

  if (sampleOrder) {
    console.log(`\n--- Single order before/after: ${sampleOrder.orderId} ---`);
    (sampleOrder.items || []).forEach((item) => {
      const productId = resolveOrderItemProductKey(item);
      const product = productById[productId];
      const qty = Number(item.quantity || 0);
      const oldUnit = Number(product?.financeRawPrice || 0);
      const newUnit = resolvePlatformUnitCost(productId, product, fgCostMap);
      console.log(
        `  ${product?.name || productId}: qty ${qty} | BEFORE $${oldUnit.toFixed(4)} | AFTER $${newUnit.toFixed(4)} | line delta $${((newUnit - oldUnit) * qty).toFixed(2)}`,
      );
    });
    console.log(`  Order COGS BEFORE: $${sampleOrder.oldLine.toFixed(2)}`);
    console.log(`  Order COGS AFTER:  $${sampleOrder.newLine.toFixed(2)}`);
  }

  console.log('\n--- Totals (paid IM invoices) ---');
  console.log(`IM COGS OLD (line rawPrice first):   $${imCogsOld.toFixed(2)}`);
  console.log(`IM COGS NEW (platform cost first):   $${imCogsNew.toFixed(2)}`);
  console.log(`IM old→new delta:                    $${(imCogsNew - imCogsOld).toFixed(2)}`);

  if (mismatchLines.length) {
    console.log('\n--- Sample lines where OLD ≠ NEW (up to 10) ---');
    mismatchLines.forEach((l) => {
      console.log(
        `  inv ${l.invoiceId} | ${l.name} x${l.qty} | old $${l.oldUnit.toFixed(4)} → new $${l.newUnit.toFixed(4)} | line delta $${l.delta.toFixed(2)}`,
      );
    });
  } else {
    console.log('\nNo IM line-level mismatches between old and new costing.');
  }

  if (platformLineSamples.length) {
    console.log('\n--- Sample platform delivered lines ---');
    platformLineSamples.forEach((l) => {
      console.log(`  order ${l.orderId} | ${l.name} x${l.qty} @ $${l.unitCost.toFixed(4)} = $${l.lineCogs.toFixed(2)}`);
    });
  }

  // Pick most recent paid invoice for single-transaction before/after
  const sortedPaid = paidInvoices
    .filter((inv) => (inv.lineItems || inv.items || []).length > 0)
    .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));

  if (sortedPaid.length) {
    const inv = sortedPaid[0];
    const items = inv.lineItems || inv.items || [];
    let before = 0;
    let after = 0;
    console.log(`\n--- Single invoice before/after: ${inv.id} (${inv.date || inv.createdAt || 'no date'}) ---`);
    items.forEach((item) => {
      const productId = item.id || item.productId;
      const product = productById[productId];
      const qty = Number(item.quantity || 0);
      const oldUnit = Number(item.rawPrice || product?.financeRawPrice || 0);
      const newUnit = Number(product?.rawPrice ?? item.rawPrice ?? 0);
      before += oldUnit * qty;
      after += newUnit * qty;
      console.log(
        `  ${product?.name || item.description}: qty ${qty} | BEFORE $${oldUnit.toFixed(4)} | AFTER $${newUnit.toFixed(4)} | FG $${(product?.fgCost || 0).toFixed(4)}`,
      );
    });
    console.log(`  Invoice COGS BEFORE: $${before.toFixed(2)}`);
    console.log(`  Invoice COGS AFTER:  $${after.toFixed(2)}`);
    console.log(`  Delta:               $${(after - before).toFixed(2)}`);
  } else {
    console.log('\nNo paid finance invoices with line items found for single-transaction sample.');
  }

  console.log('\n=== Done ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
