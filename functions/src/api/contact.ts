import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'mail.grabio.space',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'no-reply@grabio.space',
    pass: process.env.SMTP_PASS || '',
  },
};

const PLATFORM_SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@grabio.space';
const SMTP_FROM = `Grabio <${process.env.SMTP_USER || 'no-reply@grabio.space'}>`;

function buildHtml(name: string, fromEmail: string, subject: string, message: string, storeName?: string): string {
  const context = storeName
    ? `<p style="color:#6b7280;font-size:13px;">Sent via the store contact form for <strong>${storeName}</strong></p>`
    : `<p style="color:#6b7280;font-size:13px;">Sent via the Grabio platform Contact Us page</p>`;

  return `
    <html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
      <div style="max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#0ea5e9;margin-bottom:4px;">New Message: ${subject}</h2>
        ${context}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:6px 0;color:#6b7280;width:100px;">From</td><td style="padding:6px 0;"><strong>${name}</strong> &lt;${fromEmail}&gt;</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Subject</td><td style="padding:6px 0;">${subject}</td></tr>
        </table>
        <div style="background:#f9fafb;border-left:4px solid #0ea5e9;padding:16px;border-radius:4px;white-space:pre-wrap;">${message}</div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Grabio — Powered by <a href="https://emoove.co" style="color:#9ca3af;">E-MOOVE</a></p>
      </div>
    </body></html>
  `;
}

/**
 * POST /contact/send
 * Body: { name, email, subject, message, storeId? }
 *
 * If storeId is provided, looks up store.proEmail and sends there.
 * Otherwise sends to the platform support email.
 * Also saves the message to Firestore.
 */
export async function sendContactEmail(req: Request, res: Response): Promise<void> {
  const { name, email, subject, message, storeId } = req.body as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
    storeId?: string;
  };

  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: 'Missing required fields: name, email, subject, message' });
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  try {
    const db = admin.firestore();
    let toEmail = PLATFORM_SUPPORT_EMAIL;
    let storeName: string | undefined;

    // If storeId provided, look up the store's proEmail
    if (storeId) {
      const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
      if (storeSnap.exists) {
        const storeData = storeSnap.data() as { proEmail?: string; name?: string };
        if (storeData.proEmail) toEmail = storeData.proEmail;
        storeName = storeData.name;
      }
    }

    // Save to Firestore
    const collection = storeId ? 'storeContactMessages' : 'contactMessages';
    await db.collection(collection).add({
      name,
      email,
      subject,
      message,
      ...(storeId ? { storeId, storeName } : {}),
      toEmail,
      status: 'new',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email via SMTP
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    await transporter.sendMail({
      from: SMTP_FROM,
      to: toEmail,
      replyTo: `${name} <${email}>`,
      subject: storeName ? `[${storeName}] ${subject}` : `[Grabio Contact] ${subject}`,
      html: buildHtml(name, email, subject, message, storeName),
    });

    // Auto-reply to sender
    await transporter.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'We received your message',
      html: `
        <html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
          <div style="max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#0ea5e9;">Hi ${name},</h2>
            <p>Thank you for reaching out${storeName ? ` to <strong>${storeName}</strong>` : ''}! We received your message and will get back to you as soon as possible.</p>
            <div style="background:#f9fafb;border-left:4px solid #0ea5e9;padding:16px;border-radius:4px;">
              <p style="margin:0;color:#6b7280;font-size:13px;">Your message:</p>
              <p style="margin:8px 0 0 0;white-space:pre-wrap;">${message}</p>
            </div>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Grabio — Powered by <a href="https://emoove.co" style="color:#9ca3af;">E-MOOVE</a></p>
          </div>
        </body></html>
      `,
    });

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Contact email error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
}
