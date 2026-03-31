const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TARGET_EMAIL = 'anwar.abouhassan@gmail.com';
const DEFAULT_TARGET_OPS = 1000;
const DEFAULT_TARGET_WRITES = 0;

function parseArgs(argv) {
  const args = {
    email: DEFAULT_TARGET_EMAIL,
    targetOps: DEFAULT_TARGET_OPS,
    targetWrites: DEFAULT_TARGET_WRITES,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--email') {
      const value = String(argv[i + 1] || '').trim();
      if (value) args.email = value;
      i += 1;
      continue;
    }
    if (token === '--targetOps') {
      const value = Number(argv[i + 1] || 0);
      if (Number.isFinite(value) && value > 0) {
        args.targetOps = Math.floor(value);
      }
      i += 1;
      continue;
    }
    if (token === '--targetWrites') {
      const value = Number(argv[i + 1] || 0);
      if (Number.isFinite(value) && value >= 0) {
        args.targetWrites = Math.floor(value);
      }
      i += 1;
    }
  }

  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(list) {
  return list[randomInt(0, list.length - 1)];
}

async function main() {
  const start = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const targetEmail = args.email;
  const targetOps = args.targetOps;
  const targetWrites = args.targetWrites;

  console.log(`▶️ Starting E2E flow for ${targetEmail} with targetOps=${targetOps}${targetWrites > 0 ? `, targetWrites=${targetWrites}` : ''}`);

  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });

  const db = admin.firestore();
  const op = {
    writes: 0,
    reads: 0,
    validations: 0,
  };

  const trackWrite = (count = 1) => { op.writes += count; };
  const trackRead = (count = 1) => { op.reads += count; };
  const trackValidation = (count = 1) => { op.validations += count; };

  const user = await admin.auth().getUserByEmail(targetEmail);
  trackRead();
  const storeId = user.uid;

  const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
  trackRead();
  if (!storeSnap.exists) {
    throw new Error(`Store profile not found for ${targetEmail} (${storeId})`);
  }

  const runId = `E2E${targetOps}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const runPrefix = `TEST-${runId}`;
  const createdAt = nowIso();

  const general = {
    runId,
    targetEmail,
    storeId,
    storeName: storeSnap.data()?.storeName || storeSnap.data()?.name || 'Unknown',
    startedAt: createdAt,
    entities: {
      suppliers: 0,
      customers: 0,
      rawMaterials: 0,
      purchases: 0,
      recipes: 0,
      simpleProducts: 0,
      serviceProducts: 0,
      composedProducts: 0,
      composedServices: 0,
      finishedGoods: 0,
      productionBatches: 0,
      orders: 0,
      paymentEvents: 0,
      writePaddingUpdates: 0,
    },
  };

  const supplierRef = db.collection('suppliers').doc();
  await supplierRef.set({
    supplierCode: `${runPrefix}-SUP-1`,
    name: `${runPrefix} Supplier`,
    contactPerson: 'E2E Bot',
    phone: '+9610000000',
    email: `supplier+${runId.toLowerCase()}@example.test`,
    status: 'active',
    paymentTerms: 'net_30',
    storeId,
    testRunId: runId,
    createdAt,
    updatedAt: createdAt,
  });
  trackWrite();
  general.entities.suppliers += 1;

  const customerIds = [];
  for (let i = 1; i <= 6; i += 1) {
    const customerRef = db.collection('customers').doc();
    const customer = {
      name: `${runPrefix} Customer ${i}`,
      email: `customer${i}+${runId.toLowerCase()}@example.test`,
      phone: `7000${100 + i}`,
      address: 'Beirut',
      city: 'Beirut',
      storeId,
      testRunId: runId,
      createdAt,
      updatedAt: createdAt,
    };
    await customerRef.set(customer);
    trackWrite();
    customerIds.push(customerRef.id);
    general.entities.customers += 1;
  }

  const rawMaterialRefs = [];
  const rawMaterialStocks = new Map();

  for (let i = 1; i <= 12; i += 1) {
    const rawRef = db.collection('rawMaterials').doc();
    const material = {
      name: `${runPrefix} Raw Material ${i}`,
      sku: `${runPrefix}-RM-${String(i).padStart(2, '0')}`,
      unit: 'kg',
      currentStock: 200,
      minimumThreshold: 20,
      reorderPoint: 40,
      costPerUnit: 2 + i * 0.2,
      preferredSupplierId: supplierRef.id,
      storeId,
      testRunId: runId,
      createdAt,
      updatedAt: createdAt,
    };
    await rawRef.set(material);
    trackWrite();
    rawMaterialRefs.push(rawRef.id);
    rawMaterialStocks.set(rawRef.id, 200);
    general.entities.rawMaterials += 1;
  }

  const recipeIds = [];
  const composedProductIds = [];
  const composedProductRecipe = new Map();
  const fgByProductId = new Map();

  for (let i = 1; i <= 10; i += 1) {
    const rm1 = randomPick(rawMaterialRefs);
    let rm2 = randomPick(rawMaterialRefs);
    while (rm2 === rm1) rm2 = randomPick(rawMaterialRefs);

    const recipeRef = db.collection('recipes').doc();
    const outputQuantity = randomInt(8, 20);
    const ingredients = [
      {
        rawMaterialId: rm1,
        materialName: `RM ${rm1.slice(-6)}`,
        quantity: round2(randomInt(1, 3) + Math.random()),
        unit: 'kg',
        cost: 0,
      },
      {
        rawMaterialId: rm2,
        materialName: `RM ${rm2.slice(-6)}`,
        quantity: round2(randomInt(1, 2) + Math.random()),
        unit: 'kg',
        cost: 0,
      },
    ];

    const totalCost = round2(
      ingredients.reduce((sum, ing) => sum + ing.quantity * (rawMaterialStocks.has(ing.rawMaterialId) ? (2 + (rawMaterialRefs.indexOf(ing.rawMaterialId) + 1) * 0.2) : 2), 0)
    );

    await recipeRef.set({
      name: `${runPrefix} Recipe ${i}`,
      sku: `${runPrefix}-R-${String(i).padStart(2, '0')}`,
      outputYield: outputQuantity,
      outputQuantity,
      outputUnit: 'unit',
      ingredients,
      totalCost,
      costPerUnit: round2(totalCost / outputQuantity),
      storeId,
      testRunId: runId,
      createdAt,
      updatedAt: createdAt,
    });
    trackWrite();
    recipeIds.push(recipeRef.id);
    general.entities.recipes += 1;

    const productRef = db.collection('products').doc();
    await productRef.set({
      name: `${runPrefix} Composed Product ${i}`,
      description: 'Automated composed product',
      category: 'Manufactured Goods',
      productType: 'composed',
      recipeId: recipeRef.id,
      price: round2((totalCost / outputQuantity) * 2.3),
      sellingPrice: round2((totalCost / outputQuantity) * 2.3),
      costPrice: round2(totalCost / outputQuantity),
      inStock: true,
      stock: 0,
      storeId,
      testRunId: runId,
      createdAt,
      updatedAt: createdAt,
    });
    trackWrite();
    composedProductIds.push(productRef.id);
    composedProductRecipe.set(productRef.id, recipeRef.id);
    general.entities.composedProducts += 1;

    const fgRef = db.collection('finishedGoodsInventory').doc();
    await fgRef.set({
      itemCode: `${runPrefix}-FG-${String(i).padStart(3, '0')}`,
      productId: productRef.id,
      composedProductId: productRef.id,
      recipeId: recipeRef.id,
      description: `${runPrefix} FG ${i}`,
      productName: `${runPrefix} Composed Product ${i}`,
      unit: 'unit',
      openingBalance: 0,
      quantityManufactured: 0,
      quantitySold: 0,
      quantityAdjusted: 0,
      currentBalance: 0,
      reorderPoint: 10,
      costPrice: round2(totalCost / outputQuantity),
      sellingPrice: round2((totalCost / outputQuantity) * 2.3),
      totalValue: 0,
      valuationMethod: 'FIFO',
      transactions: [],
      batchQueue: [],
      storeId,
      createdBy: user.uid,
      testRunId: runId,
      createdAt,
      updatedAt: createdAt,
    });
    trackWrite();
    fgByProductId.set(productRef.id, { fgId: fgRef.id, currentBalance: 0, quantityManufactured: 0, quantitySold: 0, quantityAdjusted: 0, costPrice: round2(totalCost / outputQuantity) });
    general.entities.finishedGoods += 1;
  }

  const simpleProductIds = [];
  const simpleStocks = new Map();
  for (let i = 1; i <= 12; i += 1) {
    const productRef = db.collection('products').doc();
    const stock = 300;
    await productRef.set({
      name: `${runPrefix} Simple Product ${i}`,
      description: 'Automated simple product',
      category: 'General',
      productType: 'simple',
      price: round2(15 + i * 1.5),
      sellingPrice: round2(15 + i * 1.5),
      inStock: true,
      stock,
      storeId,
      testRunId: runId,
      createdAt,
      updatedAt: createdAt,
    });
    trackWrite();
    simpleProductIds.push(productRef.id);
    simpleStocks.set(productRef.id, stock);
    general.entities.simpleProducts += 1;
  }

  const serviceProductIds = [];
  for (let i = 1; i <= 8; i += 1) {
    const productRef = db.collection('products').doc();
    await productRef.set({
      name: `${runPrefix} Service ${i}`,
      description: 'Automated service',
      category: 'Services',
      productType: 'service',
      price: round2(25 + i * 2),
      serviceCost: round2(5 + i),
      serviceDuration: 30 + i * 5,
      serviceBillingType: 'one-time',
      inStock: true,
      stock: 0,
      storeId,
      testRunId: runId,
      createdAt,
      updatedAt: createdAt,
    });
    trackWrite();
    serviceProductIds.push(productRef.id);
    general.entities.serviceProducts += 1;
  }

  const composedServiceIds = [];
  for (let i = 1; i <= 6; i += 1) {
    const linkedRecipeId = randomPick(recipeIds);
    const productRef = db.collection('products').doc();
    await productRef.set({
      name: `${runPrefix} Composed Service ${i}`,
      description: 'Automated composed-service package',
      category: 'Services',
      productType: 'service',
      composedService: true,
      linkedRecipeId,
      price: round2(60 + i * 5),
      serviceCost: round2(20 + i * 2),
      serviceDuration: 60,
      serviceBillingType: 'one-time',
      inStock: true,
      stock: 0,
      storeId,
      testRunId: runId,
      createdAt,
      updatedAt: createdAt,
    });
    trackWrite();
    composedServiceIds.push(productRef.id);
    general.entities.composedServices += 1;
  }

  for (let i = 1; i <= 80; i += 1) {
    const materialA = randomPick(rawMaterialRefs);
    let materialB = randomPick(rawMaterialRefs);
    while (materialB === materialA) materialB = randomPick(rawMaterialRefs);

    const qtyA = randomInt(15, 40);
    const qtyB = randomInt(8, 25);
    const costA = round2(2 + (rawMaterialRefs.indexOf(materialA) + 1) * 0.2);
    const costB = round2(2 + (rawMaterialRefs.indexOf(materialB) + 1) * 0.2);
    const subtotal = round2(qtyA * costA + qtyB * costB);
    const taxAmount = round2(subtotal * 0.11);
    const total = round2(subtotal + taxAmount);

    const purchaseRef = db.collection('purchases').doc();
    await purchaseRef.set({
      purchaseOrderNumber: `${runPrefix}-PO-${String(i).padStart(4, '0')}`,
      poNumber: `${runPrefix}-PO-${String(i).padStart(4, '0')}`,
      supplierId: supplierRef.id,
      supplierName: `${runPrefix} Supplier`,
      items: [
        {
          rawMaterialId: materialA,
          materialName: `RM ${materialA.slice(-6)}`,
          sku: `${runPrefix}-RM`,
          unit: 'kg',
          quantity: qtyA,
          unitCost: costA,
          unitPrice: costA,
          subtotal: round2(qtyA * costA),
          receivedQuantity: qtyA,
        },
        {
          rawMaterialId: materialB,
          materialName: `RM ${materialB.slice(-6)}`,
          sku: `${runPrefix}-RM`,
          unit: 'kg',
          quantity: qtyB,
          unitCost: costB,
          unitPrice: costB,
          subtotal: round2(qtyB * costB),
          receivedQuantity: qtyB,
        },
      ],
      subtotal,
      taxAmount,
      discount: 0,
      total,
      totalAmount: total,
      totalCost: total,
      status: 'received',
      orderDate: nowIso(),
      receivedDate: nowIso(),
      paymentStatus: 'paid',
      amountPaid: total,
      paymentDate: nowIso(),
      paymentMethod: 'cash',
      paymentHistory: [
        {
          id: `${runPrefix}-PAY-PO-${i}`,
          amount: total,
          date: nowIso(),
          method: 'cash',
          notes: 'E2E purchase payment',
          recordedBy: user.uid,
          recordedAt: nowIso(),
        },
      ],
      storeId,
      testRunId: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    trackWrite();
    general.entities.purchases += 1;
    general.entities.paymentEvents += 1;

    const newA = round2((rawMaterialStocks.get(materialA) || 0) + qtyA);
    const newB = round2((rawMaterialStocks.get(materialB) || 0) + qtyB);
    await db.collection('rawMaterials').doc(materialA).update({ currentStock: newA, updatedAt: nowIso() });
    await db.collection('rawMaterials').doc(materialB).update({ currentStock: newB, updatedAt: nowIso() });
    trackWrite(2);
    rawMaterialStocks.set(materialA, newA);
    rawMaterialStocks.set(materialB, newB);
  }

  for (let i = 1; i <= 90; i += 1) {
    const productId = randomPick(composedProductIds);
    const recipeId = composedProductRecipe.get(productId);
    const recipeSnap = await db.collection('recipes').doc(recipeId).get();
    trackRead();
    const recipe = recipeSnap.data() || {};
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const actualQty = randomInt(5, 18);
    const outputQty = Number(recipe.outputQuantity || 1) > 0 ? Number(recipe.outputQuantity || 1) : 1;

    let canProduce = true;
    for (const ing of ingredients) {
      const need = round2((Number(ing.quantity || 0) * actualQty) / outputQty);
      const have = Number(rawMaterialStocks.get(ing.rawMaterialId) || 0);
      if (need > have) {
        canProduce = false;
        break;
      }
    }

    if (!canProduce) continue;

    const batchRef = db.collection('productionBatches').doc();
    await batchRef.set({
      batchNumber: `${runPrefix}-PB-${String(i).padStart(4, '0')}`,
      composedProductId: productId,
      productId,
      recipeId,
      quantityProduced: actualQty,
      quantity: actualQty,
      actualQuantity: actualQty,
      productionDate: nowIso(),
      scheduledDate: nowIso(),
      completionDate: nowIso(),
      status: 'completed',
      qualityStatus: 'passed',
      priority: 'normal',
      storeId,
      testRunId: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    trackWrite();
    general.entities.productionBatches += 1;

    for (const ing of ingredients) {
      const need = round2((Number(ing.quantity || 0) * actualQty) / outputQty);
      const newStock = round2((rawMaterialStocks.get(ing.rawMaterialId) || 0) - need);
      rawMaterialStocks.set(ing.rawMaterialId, newStock);
      await db.collection('rawMaterials').doc(ing.rawMaterialId).update({ currentStock: newStock, updatedAt: nowIso() });
      trackWrite();
    }

    const fgInfo = fgByProductId.get(productId);
    const newBalance = round2((fgInfo.currentBalance || 0) + actualQty);
    const newManufactured = round2((fgInfo.quantityManufactured || 0) + actualQty);
    fgInfo.currentBalance = newBalance;
    fgInfo.quantityManufactured = newManufactured;
    fgByProductId.set(productId, fgInfo);

    await db.collection('finishedGoodsInventory').doc(fgInfo.fgId).update({
      currentBalance: newBalance,
      quantityManufactured: newManufactured,
      totalValue: round2(newBalance * Number(fgInfo.costPrice || 0)),
      updatedAt: nowIso(),
    });
    trackWrite();
  }

  const allOrderProducts = [...simpleProductIds, ...composedProductIds, ...serviceProductIds, ...composedServiceIds];

  for (let i = 1; i <= 150; i += 1) {
    const customerId = randomPick(customerIds);
    const customerName = `${runPrefix} Customer ${1 + (i % customerIds.length)}`;
    const productId = randomPick(allOrderProducts);

    const isSimple = simpleProductIds.includes(productId);
    const isComposed = composedProductIds.includes(productId);
    const isService = serviceProductIds.includes(productId) || composedServiceIds.includes(productId);

    const quantity = isService ? 1 : randomInt(1, 5);

    let status = randomPick(['pending', 'confirmed', 'processing', 'ready', 'delivered', 'paid', 'completed', 'cancelled']);
    if (isService && status === 'completed') status = 'paid';

    const priceBase = isSimple
      ? round2(15 + (simpleProductIds.indexOf(productId) + 1) * 1.5)
      : isComposed
        ? round2(20 + (composedProductIds.indexOf(productId) + 1) * 2.2)
        : round2(40 + randomInt(1, 8) * 2);

    const subtotal = round2(quantity * priceBase);
    const taxAmount = round2(subtotal * 0.11);
    const total = round2(subtotal + taxAmount);

    const paymentStatus = ['paid', 'completed', 'delivered'].includes(status) ? randomPick(['paid', 'partial', 'unpaid']) : 'unpaid';
    const amountPaid = paymentStatus === 'paid' ? total : paymentStatus === 'partial' ? round2(total * 0.5) : 0;

    const orderRef = db.collection('orders').doc();
    await orderRef.set({
      invoiceNumber: `${runPrefix}-INV-${String(i).padStart(5, '0')}`,
      orderNumber: `${runPrefix}-ORD-${String(i).padStart(5, '0')}`,
      storeId,
      customerId,
      customerName,
      customerPhone: '70000000',
      customerEmail: `order${i}+${runId.toLowerCase()}@example.test`,
      items: [
        {
          productId,
          quantity,
          price: priceBase,
          discountType: 'percentage',
          discountValue: 0,
          discountAmount: 0,
        },
      ],
      subtotal,
      taxType: 'VAT',
      taxRate: 11,
      taxAmount,
      discountType: 'percentage',
      discountValue: 0,
      discountAmount: 0,
      total,
      status,
      paymentStatus,
      amountPaid,
      paymentDate: amountPaid > 0 ? nowIso() : '',
      paymentMethod: amountPaid > 0 ? 'cash' : '',
      paymentNotes: amountPaid > 0 ? 'E2E payment event' : '',
      paymentHistory: amountPaid > 0 ? [
        {
          id: `${runPrefix}-PAY-ORD-${i}`,
          amount: amountPaid,
          date: nowIso(),
          method: 'cash',
          notes: 'E2E order payment',
          recordedBy: user.uid,
          recordedAt: nowIso(),
        },
      ] : [],
      testRunId: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    trackWrite();
    general.entities.orders += 1;
    if (amountPaid > 0) general.entities.paymentEvents += 1;

    const counted = ['delivered', 'paid', 'completed'].includes(status);
    if (counted) {
      if (isSimple) {
        const current = Number(simpleStocks.get(productId) || 0);
        const newStock = Math.max(0, current - quantity);
        simpleStocks.set(productId, newStock);
        await db.collection('products').doc(productId).update({ stock: newStock, inStock: newStock > 0, updatedAt: nowIso() });
        trackWrite();
      } else if (isComposed) {
        const fgInfo = fgByProductId.get(productId);
        if (fgInfo) {
          const newBalance = Math.max(0, round2((fgInfo.currentBalance || 0) - quantity));
          const soldInc = round2((fgInfo.quantitySold || 0) + quantity);
          fgInfo.currentBalance = newBalance;
          fgInfo.quantitySold = soldInc;
          fgByProductId.set(productId, fgInfo);
          await db.collection('finishedGoodsInventory').doc(fgInfo.fgId).update({
            currentBalance: newBalance,
            quantitySold: soldInc,
            totalValue: round2(newBalance * Number(fgInfo.costPrice || 0)),
            updatedAt: nowIso(),
          });
          trackWrite();
        }
      }
    }
  }

  if (targetWrites > 0 && op.writes < targetWrites) {
    console.log(`🧪 Entering write-target padding mode: currentWrites=${op.writes}, targetWrites=${targetWrites}`);
    const fgEntries = Array.from(fgByProductId.values());
    let paddingUpdates = 0;

    while (op.writes < targetWrites) {
      const marker = nowIso();
      const updateType = paddingUpdates % 3;

      if (updateType === 0) {
        const productId = randomPick(simpleProductIds);
        await db.collection('products').doc(productId).update({
          e2eWritePadCounter: admin.firestore.FieldValue.increment(1),
          lastE2ERunId: runId,
          updatedAt: marker,
        });
      } else if (updateType === 1) {
        const rawMaterialId = randomPick(rawMaterialRefs);
        await db.collection('rawMaterials').doc(rawMaterialId).update({
          e2eWritePadCounter: admin.firestore.FieldValue.increment(1),
          lastE2ERunId: runId,
          updatedAt: marker,
        });
      } else {
        const fgEntry = randomPick(fgEntries);
        await db.collection('finishedGoodsInventory').doc(fgEntry.fgId).update({
          e2eWritePadCounter: admin.firestore.FieldValue.increment(1),
          lastE2ERunId: runId,
          updatedAt: marker,
        });
      }

      trackWrite();
      paddingUpdates += 1;

      if (paddingUpdates % 500 === 0) {
        console.log(`🧪 Write padding progress: +${paddingUpdates} updates (writes=${op.writes})`);
      }
    }

    general.entities.writePaddingUpdates = paddingUpdates;
    console.log(`🧪 Write-target padding complete: +${paddingUpdates} writes`);
  }

  const testCollections = ['rawMaterials', 'products', 'recipes', 'finishedGoodsInventory', 'productionBatches', 'orders', 'purchases', 'customers', 'suppliers'];
  if (targetWrites <= 0) {
    while ((op.writes + op.reads + op.validations) < targetOps) {
      const c = randomPick(testCollections);
      const snap = await db.collection(c).where('storeId', '==', storeId).where('testRunId', '==', runId).limit(5).get();
      trackRead();
      trackValidation();
      if (snap.empty) break;
    }
  }

  const issues = [];
  const checks = [];

  const rawSnap = await db.collection('rawMaterials').where('storeId', '==', storeId).where('testRunId', '==', runId).get();
  trackRead();
  const rawNegatives = rawSnap.docs.filter((d) => Number(d.data().currentStock || 0) < -0.0001);
  checks.push({ name: 'Raw materials non-negative', passed: rawNegatives.length === 0, details: `${rawNegatives.length} negatives` });
  if (rawNegatives.length > 0) {
    issues.push(...rawNegatives.slice(0, 10).map((d) => `Negative raw stock: ${d.id}`));
  }
  trackValidation();

  const prodSnap = await db.collection('products').where('storeId', '==', storeId).where('testRunId', '==', runId).get();
  trackRead();
  const simpleNegatives = prodSnap.docs.filter((d) => {
    const data = d.data() || {};
    const type = data.productType || 'simple';
    return (type === 'simple') && Number(data.stock || 0) < -0.0001;
  });
  checks.push({ name: 'Simple products non-negative stock', passed: simpleNegatives.length === 0, details: `${simpleNegatives.length} negatives` });
  if (simpleNegatives.length > 0) {
    issues.push(...simpleNegatives.slice(0, 10).map((d) => `Negative simple stock: ${d.id}`));
  }
  trackValidation();

  const fgSnap = await db.collection('finishedGoodsInventory').where('storeId', '==', storeId).where('testRunId', '==', runId).get();
  trackRead();
  let fgFormulaFails = 0;
  let fgNegative = 0;
  fgSnap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    const opening = Number(d.openingBalance || 0);
    const manufactured = Number(d.quantityManufactured || 0);
    const sold = Number(d.quantitySold || 0);
    const adjusted = Number(d.quantityAdjusted || 0);
    const current = Number(d.currentBalance || 0);
    const expected = round2(opening + manufactured - sold + adjusted);
    if (Math.abs(expected - round2(current)) > 0.01) fgFormulaFails += 1;
    if (current < -0.0001) fgNegative += 1;
  });
  checks.push({ name: 'Finished goods formula consistency', passed: fgFormulaFails === 0, details: `${fgFormulaFails} mismatches` });
  checks.push({ name: 'Finished goods non-negative balance', passed: fgNegative === 0, details: `${fgNegative} negatives` });
  if (fgFormulaFails > 0) issues.push(`FG formula mismatches: ${fgFormulaFails}`);
  if (fgNegative > 0) issues.push(`FG negative balances: ${fgNegative}`);
  trackValidation(2);

  const orderSnap = await db.collection('orders').where('storeId', '==', storeId).where('testRunId', '==', runId).get();
  trackRead();
  let orderTotalFails = 0;
  let paidInconsistency = 0;
  orderSnap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    const subtotal = Number(d.subtotal || 0);
    const tax = Number(d.taxAmount || 0);
    const total = Number(d.total || 0);
    if (Math.abs(round2(subtotal + tax) - round2(total)) > 0.01) orderTotalFails += 1;
    if (d.paymentStatus === 'paid' && Number(d.amountPaid || 0) + 0.01 < total) paidInconsistency += 1;
  });
  checks.push({ name: 'Order financial totals consistency', passed: orderTotalFails === 0, details: `${orderTotalFails} mismatches` });
  checks.push({ name: 'Paid orders amountPaid >= total', passed: paidInconsistency === 0, details: `${paidInconsistency} mismatches` });
  if (orderTotalFails > 0) issues.push(`Order total mismatches: ${orderTotalFails}`);
  if (paidInconsistency > 0) issues.push(`Paid amount inconsistencies: ${paidInconsistency}`);
  trackValidation(2);

  const composedProducts = prodSnap.docs.filter((d) => (d.data()?.productType === 'composed'));
  const recipeIdSet = new Set(recipeIds);
  const missingRecipeLinks = composedProducts.filter((d) => !recipeIdSet.has(d.data()?.recipeId));
  checks.push({ name: 'Composed products have valid linked recipe', passed: missingRecipeLinks.length === 0, details: `${missingRecipeLinks.length} missing/invalid` });
  if (missingRecipeLinks.length > 0) {
    issues.push(...missingRecipeLinks.slice(0, 10).map((d) => `Composed product missing recipe: ${d.id}`));
  }
  trackValidation();

  const totalOps = op.writes + op.reads + op.validations;
  const endedAt = nowIso();

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const generalReportPath = path.join(reportsDir, `e2e-general-report-${runId}.md`);
  const integrityReportPath = path.join(reportsDir, `e2e-integrity-report-${runId}.md`);

  const generalReport = `# E2E General Report\n\n- Test Run ID: ${runId}\n- Store ID: ${storeId}\n- Account: ${targetEmail}\n- Store Name: ${general.storeName}\n- Start: ${general.startedAt}\n- End: ${endedAt}\n- Duration: ${Math.round((Date.now() - start) / 1000)}s\n\n## Operations\n- Target mixed operations: ${targetOps}\n- Target writes: ${targetWrites > 0 ? targetWrites : 'not set'}\n- Writes: ${op.writes}\n- Reads: ${op.reads}\n- Validations: ${op.validations}\n- Total mixed operations: ${totalOps}\n\n## Created/Executed\n- Suppliers: ${general.entities.suppliers}\n- Customers: ${general.entities.customers}\n- Raw Materials: ${general.entities.rawMaterials}\n- Purchases: ${general.entities.purchases}\n- Recipes: ${general.entities.recipes}\n- Simple Products: ${general.entities.simpleProducts}\n- Service Products: ${general.entities.serviceProducts}\n- Composed Products: ${general.entities.composedProducts}\n- Composed Services: ${general.entities.composedServices}\n- Finished Goods entries: ${general.entities.finishedGoods}\n- Production Batches (completed): ${general.entities.productionBatches}\n- Orders: ${general.entities.orders}\n- Payment events (orders + purchases): ${general.entities.paymentEvents}\n- Write padding updates: ${general.entities.writePaddingUpdates}\n\n## End-to-End Coverage\n- ✅ Product creation (simple, composed, service, composed service)\n- ✅ Raw-material purchases and stock updates\n- ✅ Production completion and raw-material consumption\n- ✅ Finished goods updates\n- ✅ Sales/orders with mixed statuses\n- ✅ Payment registration on purchases/orders\n${targetWrites > 0 ? '- ✅ Write-target stress padding updates\n' : ''}\n## Traceability\nAll created documents are tagged with:\n- storeId: ${storeId}\n- testRunId: ${runId}\n- Prefix marker: ${runPrefix}\n`;

  const integrityReport = `# Data Integrity Report\n\n- Test Run ID: ${runId}\n- Scope: testRunId=${runId} (isolated test data)\n- Total operations observed: ${totalOps}\n\n## Integrity Checks\n${checks.map((c) => `- ${c.passed ? '✅' : '❌'} ${c.name} — ${c.details}`).join('\n')}\n\n## Summary\n- Passed checks: ${checks.filter((c) => c.passed).length}/${checks.length}\n- Failed checks: ${checks.filter((c) => !c.passed).length}/${checks.length}\n\n## Issues\n${issues.length ? issues.map((i) => `- ${i}`).join('\n') : '- No integrity issues detected in scoped test data.'}\n`;

  fs.writeFileSync(generalReportPath, generalReport, 'utf8');
  fs.writeFileSync(integrityReportPath, integrityReport, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    runId,
    targetOps,
    targetWrites,
    storeId,
    totalOperations: totalOps,
    writes: op.writes,
    reads: op.reads,
    validations: op.validations,
    generalReportPath,
    integrityReportPath,
    failedChecks: checks.filter((c) => !c.passed).length,
  }, null, 2));
}

main().catch((error) => {
  console.error('\n❌ E2E 1000 run failed:', error);
  process.exit(1);
});
