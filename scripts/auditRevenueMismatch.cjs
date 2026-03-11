const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U",
  authDomain: "market-flow-7b074.firebaseapp.com",
  projectId: "market-flow-7b074",
  storageBucket: "market-flow-7b074.appspot.com",
  messagingSenderId: "997465465802",
  appId: "1:997465465802:web:3c6789ea41a9458a98e533"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function normalizeDate(input) {
  if (!input) return '';
  if (typeof input === 'string') {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return '';
  }
  if (input.toDate) {
    const d = input.toDate();
    if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

async function main() {
  const storeId = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
  const ordersSnap = await getDocs(collection(db, 'orders'));

  const delivered = [];
  ordersSnap.forEach(doc => {
    const o = doc.data();
    if (o.storeId !== storeId) return;
    if (o.status !== 'delivered') return;
    delivered.push({ id: doc.id, ...o });
  });

  const dashboardTotal = delivered.reduce((s, o) => s + (o.total || 0), 0);

  let productSummaryTotal_CurrentLogic = 0;
  let productSummaryTotal_ExactAllocation = 0;
  const badOrders = [];

  for (const order of delivered) {
    const items = order.items || [];
    const orderTotal = order.total || 0;
    const orderSubtotal = order.subtotal || order.total || 0;
    const orderDiscount = order.discountAmount || 0;

    // Current AccountStatement product logic
    let currentSum = 0;
    for (const item of items) {
      const qty = item.quantity || 0;
      const price = item.price || 0;
      const itemSubtotal = qty * price;
      const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
      currentSum += (itemSubtotal - itemDiscount);
    }
    productSummaryTotal_CurrentLogic += currentSum;

    // Exact allocation logic (matches dashboard total by construction)
    const itemSubtotals = items.map(it => (it.quantity || 0) * (it.price || 0));
    const computedSubtotal = itemSubtotals.reduce((a, b) => a + b, 0);
    const baseSubtotal = computedSubtotal > 0 ? computedSubtotal : (orderSubtotal || orderTotal || 0);
    let allocSum = 0;
    for (let i = 0; i < items.length; i++) {
      let itemRevenue = 0;
      if (baseSubtotal > 0) {
        itemRevenue = (itemSubtotals[i] / baseSubtotal) * orderTotal;
      } else if (items.length > 0) {
        itemRevenue = orderTotal / items.length;
      }
      if (i === items.length - 1) itemRevenue = orderTotal - allocSum;
      else allocSum += itemRevenue;
      productSummaryTotal_ExactAllocation += itemRevenue;
    }

    const deltaCurrentVsOrder = +(currentSum - orderTotal).toFixed(6);
    if (Math.abs(deltaCurrentVsOrder) > 0.01) {
      badOrders.push({
        invoice: order.invoiceNumber || order.id,
        date: normalizeDate(order.createdAt),
        orderTotal,
        currentItemsSum: +currentSum.toFixed(2),
        delta: +deltaCurrentVsOrder.toFixed(2),
        subtotal: orderSubtotal,
        discountAmount: orderDiscount,
      });
    }
  }

  console.log('\n=== REVENUE MISMATCH AUDIT (DELIVERED ONLY) ===\n');
  console.log('Delivered orders count:', delivered.length);
  console.log('Dashboard / Sales total:', dashboardTotal.toFixed(2));
  console.log('Product total (current AccountStatement logic):', productSummaryTotal_CurrentLogic.toFixed(2));
  console.log('Product total (exact allocation):', productSummaryTotal_ExactAllocation.toFixed(2));
  console.log('Delta current product vs dashboard:', (productSummaryTotal_CurrentLogic - dashboardTotal).toFixed(2));
  console.log('Delta exact allocation vs dashboard:', (productSummaryTotal_ExactAllocation - dashboardTotal).toFixed(2));

  console.log('\nOrders causing mismatch (current product logic != order total):', badOrders.length);
  badOrders.slice(0, 30).forEach((o, i) => {
    console.log(`${i + 1}. ${o.invoice} (${o.date}) total=${o.orderTotal.toFixed(2)} items=${o.currentItemsSum.toFixed(2)} delta=${o.delta.toFixed(2)} subtotal=${o.subtotal.toFixed(2)} discount=${o.discountAmount.toFixed(2)}`);
  });

  if (badOrders.length > 30) {
    console.log(`... and ${badOrders.length - 30} more`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
