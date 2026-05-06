import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

const db = admin.firestore();

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'mail.grabio.space',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'no-reply@grabio.space',
    pass: process.env.SMTP_PASS || '',
  },
};

const SMTP_FROM = 'Grabio <no-reply@grabio.space>';

type NotificationLogStatus = 'pending' | 'sent' | 'failed' | 'skipped';
type NotificationChannel = 'email' | 'whatsapp';

type OrderNotificationContext = {
  orderId: string;
  storeId: string;
  invoiceNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  total?: number;
  createdAt?: unknown;
};

function normalizeEmail(value?: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value?: string): string {
  return String(value || '').replace(/\s+/g, '').trim();
}

async function createNotificationLog(input: {
  storeId: string;
  orderId: string;
  channel: NotificationChannel;
  recipient?: string;
  provider?: string;
  status: NotificationLogStatus;
  reason?: string;
  attempts?: number;
}) {
  await db.collection('orderNotifications').add({
    ...input,
    attempts: input.attempts ?? 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function updateNotificationLog(logId: string, input: {
  status: NotificationLogStatus;
  reason?: string;
  attempts?: number;
  provider?: string;
}) {
  await db.collection('orderNotifications').doc(logId).set({
    ...input,
    lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

function formatOrderDate(value: unknown): string {
  if (!value) return new Date().toLocaleString();
  try {
    if (value instanceof Date) return value.toLocaleString();
    const maybeTs = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTs.toDate === 'function') return maybeTs.toDate().toLocaleString();
    if (typeof maybeTs.seconds === 'number') return new Date(maybeTs.seconds * 1000).toLocaleString();
    return new Date(String(value)).toLocaleString();
  } catch {
    return new Date().toLocaleString();
  }
}

async function sendOrderEmail(ctx: OrderNotificationContext): Promise<{ status: NotificationLogStatus; reason?: string; provider: string }> {
  if (!ctx.customerEmail) {
    return { status: 'skipped', reason: 'Missing customer email', provider: 'smtp' };
  }

  try {
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    const orderDate = formatOrderDate(ctx.createdAt);
    const shortCode = ctx.orderId.slice(-8).toUpperCase();
    const trackUrl = `https://grabio.space/track/${ctx.orderId}`;
    await transporter.sendMail({
      from: SMTP_FROM,
      to: ctx.customerEmail,
      subject: `Order confirmed — your code is ${shortCode}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #1f2937; line-height:1.5; background:#f8fafc; margin:0; padding:20px;">
            <div style="max-width: 520px; margin: 0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
              <div style="background:#38B2AC; padding:24px 32px;">
                <h1 style="color:#fff; margin:0; font-size:22px;">Order Confirmed ✅</h1>
              </div>
              <div style="padding:24px 32px;">
                <p style="margin:0 0 8px;">Hi <strong>${ctx.customerName || 'Customer'}</strong>,</p>
                <p style="margin:0 0 16px;">Your order has been placed successfully.</p>

                <div style="background:#f0fdf4; border:1.5px solid #38B2AC; border-radius:10px; padding:16px; margin:0 0 20px; text-align:center;">
                  <p style="color:#6b7280; margin:0 0 6px; font-size:13px;">Your order tracking code</p>
                  <p style="font-size:30px; font-weight:700; color:#38B2AC; letter-spacing:5px; margin:0;">${shortCode}</p>
                  <p style="color:#9ca3af; font-size:11px; margin:8px 0 0;">Enter this code in the Grabio app → Orders tab</p>
                </div>

                <p style="margin:0 0 6px;"><strong>Order:</strong> ${ctx.invoiceNumber || ctx.orderId}</p>
                <p style="margin:0 0 6px;"><strong>Date:</strong> ${orderDate}</p>
                <p style="margin:0 0 20px;"><strong>Total:</strong> $${Number(ctx.total || 0).toFixed(2)}</p>

                <div style="text-align:center; margin:0 0 8px;">
                  <a href="${trackUrl}" style="background:#38B2AC; color:#fff; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:700; font-size:15px; display:inline-block;">
                    Track My Order →
                  </a>
                </div>
              </div>
              <div style="padding:16px 32px; background:#f9fafb; border-top:1px solid #e5e7eb;">
                <p style="color:#9ca3af; font-size:12px; margin:0; text-align:center;">© 2026 Grabio · grabio.space</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { status: 'sent', provider: 'smtp' };
  } catch (error) {
    console.error('Order email send failed', error);
    return { status: 'failed', reason: error instanceof Error ? error.message : 'Email send failed', provider: 'smtp' };
  }
}

async function sendOwnerOrderEmail(
  ctx: OrderNotificationContext,
  storeData: FirebaseFirestore.DocumentData,
): Promise<{ status: NotificationLogStatus; reason?: string; provider: string }> {
  try {
    const ownerSnap = await db.collection('users').where('storeId', '==', ctx.storeId).limit(1).get();
    if (ownerSnap.empty) {
      return { status: 'skipped', reason: 'Store owner not found', provider: 'smtp' };
    }

    const owner = ownerSnap.docs[0].data() || {};
    const ownerEmail = normalizeEmail(String(owner.email || ''));
    if (!ownerEmail) {
      return { status: 'skipped', reason: 'Store owner email missing', provider: 'smtp' };
    }

    const storeName = String(storeData.storeName || storeData.name || 'Your Store');
    const orderDate = formatOrderDate(ctx.createdAt);
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    await transporter.sendMail({
      from: SMTP_FROM,
      to: ownerEmail,
      subject: `New Online Order ${ctx.invoiceNumber || ctx.orderId.slice(-8)}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #1f2937; line-height:1.5;">
            <div style="max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="margin: 0 0 12px; color:#0f172a;">New Online Order Received</h2>
              <p style="margin:0 0 8px;"><strong>Store:</strong> ${storeName}</p>
              <p style="margin:0 0 8px;"><strong>Order:</strong> ${ctx.invoiceNumber || ctx.orderId}</p>
              <p style="margin:0 0 8px;"><strong>Customer:</strong> ${ctx.customerName || 'Customer'}</p>
              <p style="margin:0 0 8px;"><strong>Phone:</strong> ${ctx.customerPhone || 'N/A'}</p>
              <p style="margin:0 0 8px;"><strong>Email:</strong> ${ctx.customerEmail || 'N/A'}</p>
              <p style="margin:0 0 8px;"><strong>Date:</strong> ${orderDate}</p>
              <p style="margin:0 0 8px;"><strong>Total:</strong> $${Number(ctx.total || 0).toFixed(2)}</p>
              <p style="margin:16px 0 0;">Open your dashboard to process this order.</p>
            </div>
          </body>
        </html>
      `,
    });

    return { status: 'sent', provider: 'smtp' };
  } catch (error) {
    console.error('Owner order email send failed', error);
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Owner email send failed',
      provider: 'smtp',
    };
  }
}

async function upsertCustomerFromOrder(ctx: OrderNotificationContext): Promise<void> {
  const email = normalizeEmail(ctx.customerEmail);
  const phone = normalizePhone(ctx.customerPhone);

  if (!ctx.storeId || (!email && !phone)) {
    return;
  }

  const customersRef = db.collection('customers');
  let existingSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null = null;

  if (email) {
    existingSnap = await customersRef
      .where('storeId', '==', ctx.storeId)
      .where('email', '==', email)
      .limit(1)
      .get();
  }

  if ((!existingSnap || existingSnap.empty) && phone) {
    existingSnap = await customersRef
      .where('storeId', '==', ctx.storeId)
      .where('phone', '==', phone)
      .limit(1)
      .get();
  }

  const orderTotal = Number(ctx.total || 0);
  const safeOrderTotal = Number.isFinite(orderTotal) && orderTotal > 0 ? orderTotal : 0;

  if (existingSnap && !existingSnap.empty) {
    await existingSnap.docs[0].ref.set(
      {
        name: ctx.customerName || existingSnap.docs[0].get('name') || 'Customer',
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        totalOrders: admin.firestore.FieldValue.increment(1),
        lifetimeValue: admin.firestore.FieldValue.increment(safeOrderTotal),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  await customersRef.add({
    storeId: ctx.storeId,
    name: ctx.customerName || 'Customer',
    email,
    phone,
    totalOrders: 1,
    lifetimeValue: safeOrderTotal,
    creditLimit: 0,
    loyaltyPoints: 0,
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function sendOrderWhatsApp(ctx: OrderNotificationContext, storeData: FirebaseFirestore.DocumentData): Promise<{ status: NotificationLogStatus; reason?: string; provider: string }> {
  const whatsappWebhookUrl = String(storeData.whatsappWebhookUrl || '').trim();
  const whatsappWebhookToken = String(storeData.whatsappWebhookToken || '').trim();

  if (!ctx.customerPhone) {
    return { status: 'skipped', reason: 'Missing customer phone', provider: 'whatsapp-webhook' };
  }

  if (!whatsappWebhookUrl) {
    return { status: 'skipped', reason: 'WhatsApp provider not configured', provider: 'whatsapp-webhook' };
  }

  try {
    await axios.post(
      whatsappWebhookUrl,
      {
        orderId: ctx.orderId,
        invoiceNumber: ctx.invoiceNumber || ctx.orderId,
        customerName: ctx.customerName || 'Customer',
        customerPhone: ctx.customerPhone,
        total: Number(ctx.total || 0),
        message: `Order ${ctx.invoiceNumber || ctx.orderId} confirmed. Total: $${Number(ctx.total || 0).toFixed(2)}.`,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(whatsappWebhookToken ? { Authorization: `Bearer ${whatsappWebhookToken}` } : {}),
        },
        timeout: 15000,
      }
    );

    return { status: 'sent', provider: 'whatsapp-webhook' };
  } catch (error) {
    console.error('Order WhatsApp send failed', error);
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'WhatsApp send failed',
      provider: 'whatsapp-webhook',
    };
  }
}

async function getOrderNotificationContext(orderId: string): Promise<{ ctx: OrderNotificationContext; storeData: FirebaseFirestore.DocumentData } | null> {
  const orderSnap = await db.collection('orders').doc(orderId).get();
  if (!orderSnap.exists) return null;
  const order = orderSnap.data() || {};

  const storeId = String(order.storeId || '');
  if (!storeId) return null;

  const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
  const storeData = storeSnap.exists ? (storeSnap.data() || {}) : {};

  const ctx: OrderNotificationContext = {
    orderId,
    storeId,
    invoiceNumber: String(order.invoiceNumber || ''),
    customerName: String(order.customerName || ''),
    customerEmail: String(order.customerEmail || ''),
    customerPhone: String(order.customerPhone || ''),
    total: Number(order.total || 0),
    createdAt: order.createdAt,
  };

  return { ctx, storeData };
}

async function sendAllOrderNotifications(orderId: string): Promise<void> {
  const loaded = await getOrderNotificationContext(orderId);
  if (!loaded) return;

  const { ctx, storeData } = loaded;

  try {
    await upsertCustomerFromOrder(ctx);
  } catch (error) {
    console.error('Customer auto-upsert failed', error);
  }

  const ownerEmailResult = await sendOwnerOrderEmail(ctx, storeData);
  await createNotificationLog({
    storeId: ctx.storeId,
    orderId: ctx.orderId,
    channel: 'email',
    recipient: 'store-owner',
    provider: ownerEmailResult.provider,
    status: ownerEmailResult.status,
    reason: ownerEmailResult.reason,
  });

  const emailResult = await sendOrderEmail(ctx);
  await createNotificationLog({
    storeId: ctx.storeId,
    orderId: ctx.orderId,
    channel: 'email',
    recipient: ctx.customerEmail,
    provider: emailResult.provider,
    status: emailResult.status,
    reason: emailResult.reason,
  });

  const whatsappResult = await sendOrderWhatsApp(ctx, storeData);
  await createNotificationLog({
    storeId: ctx.storeId,
    orderId: ctx.orderId,
    channel: 'whatsapp',
    recipient: ctx.customerPhone,
    provider: whatsappResult.provider,
    status: whatsappResult.status,
    reason: whatsappResult.reason,
  });
}

export async function dispatchOrderNotifications(orderIds: string[]): Promise<void> {
  for (const orderId of orderIds) {
    try {
      await sendAllOrderNotifications(orderId);
    } catch (error) {
      console.error('dispatchOrderNotifications failed for order', orderId, error);
    }
  }
}

export async function retryOrderNotification(notificationId: string, requesterUid: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const notificationRef = db.collection('orderNotifications').doc(notificationId);
  const notificationSnap = await notificationRef.get();
  if (!notificationSnap.exists) {
    return { ok: false, error: 'Notification log not found' };
  }

  const notification = notificationSnap.data() || {};
  const storeId = String(notification.storeId || '');
  const channel = String(notification.channel || '');
  const orderId = String(notification.orderId || '');

  if (!storeId || !channel || !orderId) {
    return { ok: false, error: 'Invalid notification log data' };
  }

  const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
  const ownerId = storeSnap.exists ? String((storeSnap.data() || {}).ownerId || '') : '';
  const authorized = requesterUid === storeId || (ownerId && requesterUid === ownerId);
  if (!authorized) {
    return { ok: false, error: 'Unauthorized' };
  }

  const loaded = await getOrderNotificationContext(orderId);
  if (!loaded) {
    return { ok: false, error: 'Order not found' };
  }

  const { ctx, storeData } = loaded;
  const previousAttempts = Number(notification.attempts || 1);

  if (channel === 'email') {
    const result = await sendOrderEmail(ctx);
    await updateNotificationLog(notificationId, {
      status: result.status,
      reason: result.reason,
      provider: result.provider,
      attempts: previousAttempts + 1,
    });
    return { ok: true };
  }

  if (channel === 'whatsapp') {
    const result = await sendOrderWhatsApp(ctx, storeData);
    await updateNotificationLog(notificationId, {
      status: result.status,
      reason: result.reason,
      provider: result.provider,
      attempts: previousAttempts + 1,
    });
    return { ok: true };
  }

  return { ok: false, error: 'Unsupported notification channel' };
}
