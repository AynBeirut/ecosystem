export interface WhatsAppCartItem {
  name: string;
  qty: number;
  price: number;
  variant?: string;
}

export interface WhatsAppStoreInfo {
  storeName: string;
  whatsappNumber: string;
  currency?: string; // e.g. "USD", "LBP". Defaults to "USD"
}

/**
 * Builds a wa.me URL pre-filled with a formatted order message.
 *
 * @returns A wa.me URL string, or null if whatsappNumber is absent/empty.
 */
export function buildWhatsAppOrderURL(
  cartItems: WhatsAppCartItem[],
  storeInfo: WhatsAppStoreInfo
): string | null {
  const { storeName, whatsappNumber, currency = 'USD' } = storeInfo;

  if (!whatsappNumber || cartItems.length === 0) return null;

  // Strip everything except digits
  const phone = whatsappNumber.replace(/\D/g, '');
  if (!phone) return null;

  const formatPrice = (amount: number) => {
    // Format with 2 decimal places; avoid unnecessary trailing .00 for LBP-style amounts
    if (currency === 'LBP' || currency === 'LL') {
      return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return amount.toFixed(2);
  };

  const itemLines = cartItems
    .map(item => {
      const variantPart = item.variant ? ` (${item.variant})` : '';
      return `- ${item.qty}x ${item.name}${variantPart} — ${formatPrice(item.price * item.qty)} ${currency}`;
    })
    .join('\n');

  const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  const message = [
    `Hi, I'd like to place an order from ${storeName}:`,
    '',
    itemLines,
    '',
    `Total: ${formatPrice(total)} ${currency}`,
  ].join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
