import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { checkRealStoreForCommerce, commerceGuardHttpStatus } from '../services/storeCommerceGuard';

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'mail.grabio.space',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'no-reply@grabio.space',
    pass: process.env.SMTP_PASS || '',
  },
};

const SMTP_FROM = `Grabio <${process.env.SMTP_USER || 'no-reply@grabio.space'}>`;

/**
 * POST /marketing/subscribe
 * Body: { email, storeId }
 * Adds a subscriber to storeProfiles/{storeId}/subscribers subcollection.
 */
export async function subscribeToStore(req: Request, res: Response): Promise<void> {
  const { email, storeId, name } = req.body as {
    email?: string;
    storeId?: string;
    name?: string;
  };

  if (!email || !storeId) {
    res.status(400).json({ error: 'Missing required fields: email, storeId' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  try {
    const db = admin.firestore();
    const commerceCheck = await checkRealStoreForCommerce(db, storeId);
    if (!commerceCheck.eligible) {
      res.status(commerceGuardHttpStatus(commerceCheck.code)).json({
        error: commerceCheck.message,
        code: commerceCheck.code,
      });
      return;
    }

    const subscriberRef = db
      .collection('storeProfiles')
      .doc(storeId)
      .collection('subscribers')
      .doc(email.toLowerCase());

    await subscriberRef.set({
      email: email.toLowerCase(),
      name: name || '',
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
    }, { merge: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
}

/**
 * POST /marketing/unsubscribe
 * Body: { email, storeId }
 */
export async function unsubscribeFromStore(req: Request, res: Response): Promise<void> {
  const { email, storeId } = req.body as { email?: string; storeId?: string };
  if (!email || !storeId) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  try {
    const db = admin.firestore();
    const commerceCheck = await checkRealStoreForCommerce(db, storeId);
    if (!commerceCheck.eligible) {
      res.status(commerceGuardHttpStatus(commerceCheck.code)).json({
        error: commerceCheck.message,
        code: commerceCheck.code,
      });
      return;
    }

    await db
      .collection('storeProfiles')
      .doc(storeId)
      .collection('subscribers')
      .doc(email.toLowerCase())
      .set({ active: false }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
}

/**
 * GET /marketing/subscribers?storeId=xxx
 * Returns list of active subscribers for a store (admin only — called with Firebase auth token).
 */
export async function listSubscribers(req: Request, res: Response): Promise<void> {
  const storeId = req.query.storeId as string | undefined;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!storeId) {
    res.status(400).json({ error: 'Missing storeId' });
    return;
  }

  // Verify caller is authenticated
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await admin.auth().verifyIdToken(token);

    const db = admin.firestore();
    const commerceCheck = await checkRealStoreForCommerce(db, storeId);
    if (!commerceCheck.eligible) {
      res.status(commerceGuardHttpStatus(commerceCheck.code)).json({
        error: commerceCheck.message,
        code: commerceCheck.code,
      });
      return;
    }

    const snap = await db
      .collection('storeProfiles')
      .doc(storeId)
      .collection('subscribers')
      .where('active', '==', true)
      .get();

    const subscribers = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({
      email: d.id,
      name: d.data().name || '',
      subscribedAt: d.data().subscribedAt,
    }));

    res.json({ success: true, subscribers, total: subscribers.length });
  } catch (err) {
    console.error('List subscribers error:', err);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
}

/**
 * POST /marketing/send-campaign
 * Body: { storeId, subject, htmlBody, previewText? }
 * Sends a marketing email to all active subscribers of the store.
 * Requires Firebase auth token (admin only).
 */
export async function sendCampaign(req: Request, res: Response): Promise<void> {
  const { storeId, subject, htmlBody, previewText } = req.body as {
    storeId?: string;
    subject?: string;
    htmlBody?: string;
    previewText?: string;
  };

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!storeId || !subject || !htmlBody) {
    res.status(400).json({ error: 'Missing required fields: storeId, subject, htmlBody' });
    return;
  }
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Verify caller is the store owner
    const decoded = await admin.auth().verifyIdToken(token);
    const db = admin.firestore();

    const commerceCheck = await checkRealStoreForCommerce(db, storeId);
    if (!commerceCheck.eligible) {
      res.status(commerceGuardHttpStatus(commerceCheck.code)).json({
        error: commerceCheck.message,
        code: commerceCheck.code,
      });
      return;
    }

    const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!storeSnap.exists || storeSnap.data()?.ownerId !== decoded.uid) {
      res.status(403).json({ error: 'Forbidden: not the store owner' });
      return;
    }
    const storeName: string = storeSnap.data()?.name || 'Your Store';

    // Fetch active subscribers
    const subSnap = await db
      .collection('storeProfiles')
      .doc(storeId)
      .collection('subscribers')
      .where('active', '==', true)
      .get();

    if (subSnap.empty) {
      res.json({ success: true, sent: 0, message: 'No active subscribers' });
      return;
    }

    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    const preview = previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : '';

    const fullHtml = `
      <html>
        <body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;margin:0;padding:0;">
          ${preview}
          <div style="max-width:600px;margin:0 auto;padding:24px;">
            ${htmlBody}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
            <p style="font-size:12px;color:#9ca3af;text-align:center;">
              You are receiving this email because you subscribed to updates from <strong>${storeName}</strong> on Grabio.<br>
              <a href="https://grabio.space" style="color:#0ea5e9;">Unsubscribe</a>
            </p>
          </div>
        </body>
      </html>
    `;

    let sent = 0;
    const errors: string[] = [];

    // Send in batches of 10 to avoid SMTP throttling
    const emails: string[] = subSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.id);
    for (let i = 0; i < emails.length; i += 10) {
      const batch = emails.slice(i, i + 10);
      await Promise.all(
        batch.map((email: string) =>
          transporter
            .sendMail({
              from: SMTP_FROM,
              to: email,
              subject,
              html: fullHtml,
            })
            .then(() => { sent++; })
            .catch(err => {
              console.error(`Failed to send to ${email}:`, err);
              errors.push(email);
            })
        )
      );
    }

    // Log campaign
    await db.collection('storeProfiles').doc(storeId).collection('campaigns').add({
      subject,
      previewText: previewText || '',
      sentTo: sent,
      errors: errors.length,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      sentBy: decoded.uid,
    });

    res.json({ success: true, sent, errors: errors.length });
  } catch (err) {
    console.error('Campaign send error:', err);
    res.status(500).json({ error: 'Failed to send campaign' });
  }
}

/**
 * GET /marketing/campaigns?storeId=xxx
 * Returns past campaigns for a store (admin only).
 */
export async function listCampaigns(req: Request, res: Response): Promise<void> {
  const storeId = req.query.storeId as string | undefined;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!storeId || !token) {
    res.status(400).json({ error: 'Missing storeId or auth token' });
    return;
  }

  try {
    await admin.auth().verifyIdToken(token);
    const db = admin.firestore();
    const commerceCheck = await checkRealStoreForCommerce(db, storeId);
    if (!commerceCheck.eligible) {
      res.status(commerceGuardHttpStatus(commerceCheck.code)).json({
        error: commerceCheck.message,
        code: commerceCheck.code,
      });
      return;
    }

    const snap = await db
      .collection('storeProfiles')
      .doc(storeId)
      .collection('campaigns')
      .orderBy('sentAt', 'desc')
      .limit(50)
      .get();

    const campaigns = snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, campaigns });
  } catch (err) {
    console.error('List campaigns error:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
}
