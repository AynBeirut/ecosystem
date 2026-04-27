import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

const db = admin.firestore();

export const ALLOWED_META_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
]);

export type MetaConversionInput = {
  storeId: string;
  eventName: string;
  eventId?: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: 'website' | 'app' | 'system_generated';
  customData?: Record<string, unknown>;
  userData?: {
    email?: string;
    phone?: string;
    externalId?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
  };
  source: 'client_api' | 'order_trigger';
  orderId?: string;
};

export type MetaConversionResult = {
  ok: boolean;
  loggedEventId: string;
  sentToMeta: boolean;
  status: 'sent' | 'logged_only' | 'failed';
  reason?: string;
};

function normalizeAndHash(value: string | undefined): string | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash('sha256').update(normalized).digest('hex');
}

function normalizePhoneAndHash(value: string | undefined): string | undefined {
  const normalized = String(value || '').replace(/[^\d+]/g, '').trim();
  if (!normalized) return undefined;
  return createHash('sha256').update(normalized).digest('hex');
}

function extractMetaError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const maybeError = payload as { error?: { message?: string } };
    if (maybeError.error?.message) return maybeError.error.message;
  }
  return 'Unknown Meta API error';
}

export async function trackMetaConversion(input: MetaConversionInput): Promise<MetaConversionResult> {
  const storeId = String(input.storeId || '').trim();
  const eventName = String(input.eventName || '').trim();

  if (!storeId) {
    throw new Error('Missing storeId');
  }
  if (!eventName || !ALLOWED_META_EVENTS.has(eventName)) {
    throw new Error('Invalid or unsupported eventName');
  }

  const storeRef = db.collection('storeProfiles').doc(storeId);
  const storeSnap = await storeRef.get();
  if (!storeSnap.exists) {
    throw new Error('Store not found');
  }

  const storeData = storeSnap.data() as Record<string, unknown>;
  const metaIntegrationSettings = (storeData.metaIntegrationSettings || {}) as Record<string, unknown>;

  const pixelEnabled = Boolean(metaIntegrationSettings.pixelEnabled);
  const pixelId = String(metaIntegrationSettings.pixelId || '').trim();
  const conversionApiToken = String(metaIntegrationSettings.conversionApiToken || '').trim();

  const eventTime = Number.isFinite(input.eventTime) ? Number(input.eventTime) : Math.floor(Date.now() / 1000);
  const eventId = String(input.eventId || `${storeId}-${eventName}-${eventTime}`).trim();

  const userData = {
    em: normalizeAndHash(input.userData?.email),
    ph: normalizePhoneAndHash(input.userData?.phone),
    external_id: normalizeAndHash(input.userData?.externalId),
    client_ip_address: input.userData?.clientIpAddress || undefined,
    client_user_agent: input.userData?.clientUserAgent || undefined,
  };

  const eventPayload = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    event_source_url: input.eventSourceUrl || undefined,
    action_source: input.actionSource || 'website',
    user_data: userData,
    custom_data: input.customData || {},
  };

  const eventLogRef = db.collection('metaConversionEvents').doc();

  let sentToMeta = false;
  let status: 'sent' | 'logged_only' | 'failed' = 'logged_only';
  let reason = '';

  if (!pixelEnabled || !pixelId) {
    reason = 'Pixel is disabled or not configured';
  } else if (!conversionApiToken) {
    reason = 'Conversion API token not configured';
  } else {
    try {
      const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(conversionApiToken)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [eventPayload],
        }),
      });

      const responseJson = (await response.json()) as unknown;

      if (!response.ok) {
        status = 'failed';
        reason = extractMetaError(responseJson);
      } else {
        sentToMeta = true;
        status = 'sent';
      }
    } catch (error) {
      status = 'failed';
      reason = error instanceof Error ? error.message : 'Meta API request failed';
    }
  }

  await eventLogRef.set({
    storeId,
    orderId: input.orderId || null,
    source: input.source,
    eventName,
    eventId,
    eventTime,
    status,
    sentToMeta,
    reason: reason || null,
    eventPayload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await storeRef.set({
    metaIntegrationSettings: {
      conversionTrackingEnabled: pixelEnabled,
      lastConversionEventAt: new Date().toISOString(),
      lastConversionEventName: eventName,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ok: status !== 'failed',
    loggedEventId: eventLogRef.id,
    sentToMeta,
    status,
    reason: reason || undefined,
  };
}

export async function trackOrderPurchaseConversion(orderId: string, orderData: Record<string, unknown>): Promise<void> {
  const storeId = String(orderData.storeId || '').trim();
  if (!storeId) return;

  const total = Number(orderData.total || 0);
  const currency = String(orderData.currency || 'USD').trim() || 'USD';
  const contentIds = Array.isArray(orderData.items)
    ? (orderData.items as Array<{ productId?: string }>).map((item) => String(item.productId || '').trim()).filter(Boolean)
    : [];

  await trackMetaConversion({
    storeId,
    eventName: 'Purchase',
    eventId: `order-${orderId}-paid`,
    source: 'order_trigger',
    orderId,
    customData: {
      value: Number.isFinite(total) ? total : 0,
      currency,
      content_ids: contentIds,
      content_type: 'product',
    },
    userData: {
      email: String(orderData.customerEmail || ''),
      phone: String(orderData.customerPhone || ''),
      externalId: String(orderData.customerId || ''),
    },
  });
}
