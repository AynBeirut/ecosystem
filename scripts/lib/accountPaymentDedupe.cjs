const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function normalizeParty(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function partyAmountDateKey(party, amount, date) {
  return `${normalizeParty(party)}|${round2(amount).toFixed(2)}|${String(date || '').slice(0, 10)}`;
}

function buildOrderReceiptIndexes(receipts) {
  const byOrderId = new Map();
  const byPartyAmountDate = new Map();

  for (const receipt of receipts) {
    if (receipt.sourceType !== 'order' || !receipt.sourceId) continue;
    byOrderId.set(String(receipt.sourceId), receipt);
    const key = partyAmountDateKey(receipt.clientName, receipt.amount, receipt.paymentDate);
    if (!byPartyAmountDate.has(key)) byPartyAmountDate.set(key, receipt);
  }

  return { byOrderId, byPartyAmountDate };
}

/** Exact party+amount+AP date match to order receipt paymentDate (Phase B tagging). */
function findExactPartyAmountDateDuplicate(payment, indexes) {
  if (payment.supersededBy || payment.duplicateOfReceipt) {
    return {
      reason: 'already_tagged',
      supersededBy: payment.supersededBy,
      duplicateOfReceipt: payment.duplicateOfReceipt,
    };
  }
  if (payment.direction !== 'in' || payment.accountType !== 'customer') return null;

  const exactKey = partyAmountDateKey(payment.accountName, payment.amount, payment.date);
  const exactReceipt = indexes.byPartyAmountDate.get(exactKey);
  if (!exactReceipt) return null;

  return {
    reason: 'exact_party_amount_date',
    orderId: String(exactReceipt.sourceId),
    receiptDocId: exactReceipt.id,
    receiptSourceKey: exactReceipt.sourceKey,
    invoiceNumber: exactReceipt.invoiceNumber,
    voucherNumber: exactReceipt.voucherNumber,
  };
}

/**
 * Returns supersession metadata when an accountPayment duplicates a POS order receipt.
 */
function findSupersedingOrderReceipt(payment, indexes) {
  if (payment.supersededBy || payment.duplicateOfReceipt) {
    return {
      reason: 'already_tagged',
      supersededBy: payment.supersededBy,
      duplicateOfReceipt: payment.duplicateOfReceipt,
    };
  }

  if (payment.direction !== 'in' || payment.accountType !== 'customer') {
    return null;
  }

  const { byOrderId, byPartyAmountDate } = indexes;
  const allocation = payment.orderAllocation?.appliedOrderIds || [];

  if (allocation.length > 0) {
    const receipted = allocation.filter((orderId) => byOrderId.has(String(orderId)));
    if (receipted.length === allocation.length) {
      const primaryOrderId = String(receipted[0]);
      const receipt = byOrderId.get(primaryOrderId);
      return {
        reason: 'all_allocated_orders_receipted',
        orderId: primaryOrderId,
        receiptDocId: receipt?.id,
        receiptSourceKey: receipt?.sourceKey,
        invoiceNumber: receipt?.invoiceNumber,
        voucherNumber: receipt?.voucherNumber,
      };
    }

    if (receipted.length > 0) {
      const allocatedSum = receipted.reduce(
        (sum, orderId) => sum + round2(byOrderId.get(String(orderId))?.amount || 0),
        0,
      );
      if (round2(allocatedSum) === round2(payment.amount)) {
        const primaryOrderId = String(receipted[0]);
        const receipt = byOrderId.get(primaryOrderId);
        return {
          reason: 'allocated_orders_sum_matches_payment',
          orderId: primaryOrderId,
          receiptDocId: receipt?.id,
          receiptSourceKey: receipt?.sourceKey,
          invoiceNumber: receipt?.invoiceNumber,
          voucherNumber: receipt?.voucherNumber,
        };
      }
    }
  }

  return findExactPartyAmountDateDuplicate(payment, indexes);
}

function shouldHideLegacyAccountPayment(payment, indexes) {
  if (payment.supersededBy || payment.duplicateOfReceipt) return true;
  return findSupersedingOrderReceipt(payment, indexes) != null;
}

function simulateReceiptsFeedCounts(receipts, accountPayments) {
  const indexes = buildOrderReceiptIndexes(receipts);
  const orderReceiptCount = receipts.filter((r) => r.sourceType === 'order').length;
  let apShown = 0;
  let apHidden = 0;

  for (const payment of accountPayments) {
    if (payment.direction === 'out') {
      apShown += 1;
      continue;
    }
    if (shouldHideLegacyAccountPayment(payment, indexes)) {
      apHidden += 1;
    } else {
      apShown += 1;
    }
  }

  return {
    orderReceiptCount,
    apShown,
    apHidden,
    moneyInRows: orderReceiptCount + apShown,
    indexes,
  };
}

module.exports = {
  round2,
  normalizeParty,
  partyAmountDateKey,
  buildOrderReceiptIndexes,
  findExactPartyAmountDateDuplicate,
  findSupersedingOrderReceipt,
  shouldHideLegacyAccountPayment,
  simulateReceiptsFeedCounts,
};
