import { buildStorePublicUrl } from '@/lib/storeUrls';

export interface WhatsAppCartItem {
  name: string;
  qty: number;
  price: number;
  variant?: string;
}

export interface WhatsAppStoreInfo {
  storeName: string;
  whatsappNumber: string;
  currency?: string;
  orderReference?: string;
  orderId?: string;
  storeSlug?: string;
}

export interface WhatsAppOrderDetails {
  customerName?: string;
  customerPhone?: string;
  fulfillmentMethod?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  guestCount?: number;
  notes?: string;
  address?: string;
}

function formatScheduleLine(scheduledDate?: string, scheduledTime?: string): string | null {
  if (!scheduledDate && !scheduledTime) return null;
  if (scheduledDate && scheduledTime) {
    const d = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    }
    return `${scheduledDate} at ${scheduledTime}`;
  }
  return scheduledDate || scheduledTime || null;
}

/**
 * Builds a wa.me URL pre-filled with a formatted order message.
 */
export function buildWhatsAppOrderURL(
  cartItems: WhatsAppCartItem[],
  storeInfo: WhatsAppStoreInfo,
  details?: WhatsAppOrderDetails,
): string | null {
  const { storeName, whatsappNumber, currency = 'USD', orderReference, orderId } = storeInfo;

  if (!whatsappNumber || cartItems.length === 0) return null;

  const phone = whatsappNumber.replace(/\D/g, '');
  if (!phone) return null;

  const formatPrice = (amount: number) => {
    if (currency === 'LBP' || currency === 'LL') {
      return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return amount.toFixed(2);
  };

  const itemLines = cartItems
    .map((item) => {
      const variantPart = item.variant ? ` (${item.variant})` : '';
      return `- ${item.qty}x ${item.name}${variantPart} — ${formatPrice(item.price * item.qty)} ${currency}`;
    })
    .join('\n');

  const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  const messageParts = [
    `Hi, I'd like to place an order from ${storeName}:`,
    '',
  ];

  if (details?.customerName?.trim()) {
    messageParts.push(`Customer: ${details.customerName.trim()}`);
  }
  if (details?.customerPhone?.trim()) {
    messageParts.push(`Phone: ${details.customerPhone.trim()}`);
  }
  if (details?.fulfillmentMethod?.trim()) {
    messageParts.push(`Service: ${details.fulfillmentMethod.trim()}`);
  }
  const scheduleLine = formatScheduleLine(details?.scheduledDate, details?.scheduledTime);
  if (scheduleLine) {
    messageParts.push(`Scheduled: ${scheduleLine}`);
  }
  if (details?.guestCount && details.guestCount > 0) {
    messageParts.push(`Party size: ${details.guestCount} ${details.guestCount === 1 ? 'person' : 'people'}`);
  }
  if (details?.address?.trim()) {
    messageParts.push(`Address: ${details.address.trim()}`);
  }
  if (details?.notes?.trim()) {
    messageParts.push(`Notes: ${details.notes.trim()}`);
  }

  if (messageParts[messageParts.length - 1] !== '') {
    messageParts.push('');
  }

  messageParts.push(itemLines, '', `Total: ${formatPrice(total)} ${currency}`);

  if (orderReference) {
    messageParts.push('', `Order reference: ${orderReference}`);
  }
  if (orderId) {
    const trackPath = `/track-order?orderId=${encodeURIComponent(orderId)}`;
    const trackUrl = storeInfo.storeSlug?.trim()
      ? buildStorePublicUrl(storeInfo.storeSlug.trim(), trackPath)
      : `https://grabio.space${trackPath}`;
    messageParts.push(`Track: ${trackUrl}`);
  }

  const message = messageParts.join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
