const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const sa = require('../serviceAccountKey.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore(app);

const SMTP_CONFIG = {
  host: 'mail.grabio.space',
  port: 587,
  secure: false,
  auth: { user: 'no-reply@grabio.space', pass: '2015@2026@Gs.' },
};

async function run() {
  const orderId = 'DrALCwTFuCDD8URlwhwz';
  const orderSnap = await db.collection('orders').doc(orderId).get();
  const order = orderSnap.data();
  console.log('Order:', JSON.stringify({ storeId: order.storeId, customerEmail: order.customerEmail, total: order.total }));

  const storeSnap = await db.collection('storeProfiles').doc(order.storeId).get();
  const storeData = storeSnap.exists ? storeSnap.data() : {};
  console.log('Store:', JSON.stringify({ storeName: storeData.storeName || storeData.name }));

  const shortCode = orderId.slice(-8).toUpperCase();
  console.log('Short code:', shortCode);
  console.log('Sending to:', order.customerEmail);

  const transporter = nodemailer.createTransport(SMTP_CONFIG);
  const info = await transporter.sendMail({
    from: 'Grabio <no-reply@grabio.space>',
    to: order.customerEmail,
    subject: `📱 Mobile App Email Test — your code is ${shortCode}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;">
      <h2 style="color:#38B2AC;">Mobile App Order Confirmed ✅</h2>
      <p>This confirms the mobile app email flow is working correctly.</p>
      <div style="background:#f0fdf4;border:2px solid #38B2AC;border-radius:10px;padding:16px;text-align:center;margin:20px 0;">
        <p style="color:#6b7280;margin:0 0 6px;font-size:13px;">Your tracking code</p>
        <p style="font-size:30px;font-weight:700;color:#38B2AC;letter-spacing:5px;margin:0;">${shortCode}</p>
      </div>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Total:</strong> $${Number(order.total || 0).toFixed(2)}</p>
      <p style="color:#9ca3af;font-size:12px;">© 2026 Grabio · grabio.space</p>
    </div>`,
  });
  console.log('EMAIL SENT:', info.messageId);
}

run().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
