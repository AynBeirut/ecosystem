/**
 * Email Service for Subscription Notifications
 * Uses SMTP via nodemailer
 */

import * as nodemailer from 'nodemailer';

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
}

// SMTP Configuration from environment variables
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'mail.grabio.space',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.SMTP_USER || 'no-reply@grabio.space',
    pass: process.env.SMTP_PASS || '',
  },
};

const SMTP_FROM = 'Grabio <no-reply@grabio.space>';

/**
 * Send email via SMTP
 */
async function sendEmail(template: EmailTemplate): Promise<void> {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    
    // Send email
    await transporter.sendMail({
      from: SMTP_FROM,
      to: template.to,
      subject: template.subject,
      html: template.html,
    });
    
    console.log(`✅ Email sent to: ${template.to}`);
  } catch (error) {
    console.error('❌ Email send failed:', error);
    // Don't throw - log error but continue
    // This prevents subscription activation from failing due to email issues
  }
}

/**
 * Send legacy user activation email
 */
export async function sendLegacyUserEmail(email: string, name: string): Promise<void> {
  const template: EmailTemplate = {
    to: email,
    subject: 'Your Grabio Account - 1 Year Free Pro Access 🎉',
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Hi ${name || 'there'},</h2>
            
            <p>Great news! As a valued early user of Grabio, we're offering you:</p>
            
            <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">🎁 1 Year FREE Pro Access</h3>
              <p style="margin: 0;"><strong>✅ Valid until February 28, 2027</strong></p>
              <p style="margin: 5px 0 0 0;">✨ All features included</p>
            </div>
            
            <h3>Your Pro access includes:</h3>
            <ul>
              <li>Full Store Management</li>
              <li>POS System</li>
              <li>Composed Products & Services</li>
              <li>Advanced Production Management</li>
              <li>Raw Materials Tracking</li>
              <li>Recipe & Cost Management</li>
              <li>Priority Support</li>
            </ul>
            
            <p><strong>No action needed</strong> - your account is already activated!</p>
            
            <p>Login now: <a href="https://grabio.space" style="color: #2563eb;">grabio.space</a></p>
            
            <p style="margin-top: 30px;">Questions? Reply to this email.</p>
            
            <p>Thank you for being part of our journey!</p>
            
            <p style="margin-top: 20px;">
              Best regards,<br>
              <strong>The Grabio Team</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
              © 2026 Grabio — Powered by <a href="https://emoove.co" style="color:#9ca3af;text-decoration:none;">E-MOOVE</a>
            </p>
          </div>
        </body>
      </html>
    `
  };
  
  await sendEmail(template);
}

/**
 * Send trial activated email
 */
export async function sendTrialActivatedEmail(email: string, tier: string): Promise<void> {
  const template: EmailTemplate = {
    to: email,
    subject: 'Your Grabio Trial is Active! 🚀',
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Welcome to Grabio ${tier.toUpperCase()}!</h2>
            
            <p>Your $1 trial has been activated successfully.</p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">✅ Trial Active</h3>
              <p style="margin: 0;"><strong>Duration:</strong> 1 Month</p>
              <p style="margin: 5px 0 0 0;"><strong>Tier:</strong> ${tier.toUpperCase()}</p>
            </div>
            
            <h3>What's next?</h3>
            <ol>
              <li>Login to your admin dashboard</li>
              <li>Explore all ${tier} features</li>
              <li>Set up your store</li>
              <li>Start selling!</li>
            </ol>
            
            <p><a href="https://grabio.space/admin" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Go to Dashboard</a></p>
            
            <p>After your trial ends, you'll be able to choose a monthly or yearly plan.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Grabio Team</strong>
            </p>
          </div>
        </body>
      </html>
    `
  };
  
  await sendEmail(template);
}

/**
 * Send subscription activated email
 */
export async function sendSubscriptionActivatedEmail(
  email: string,
  tier: string,
  billing: string,
  amount: number
): Promise<void> {
  const template: EmailTemplate = {
    to: email,
    subject: `Your Grabio ${tier.toUpperCase()} Subscription is Active!`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Thank you for subscribing!</h2>
            
            <p>Your Grabio ${tier.toUpperCase()} subscription has been activated.</p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">Subscription Details</h3>
              <p style="margin: 0;"><strong>Plan:</strong> ${tier.toUpperCase()} - ${billing}</p>
              <p style="margin: 5px 0 0 0;"><strong>Amount:</strong> $${amount}</p>
              <p style="margin: 5px 0 0 0;"><strong>Next billing:</strong> ${billing === 'monthly' ? '1 month' : '1 year'} from today</p>
            </div>
            
            <h3>Your ${tier.toUpperCase()} features:</h3>
            ${tier === 'pro' ? `
              <ul>
                <li>Full Store Management</li>
                <li>POS System</li>
                <li>Composed Products & Services</li>
                <li>Advanced Production Management</li>
                <li>Priority Support</li>
              </ul>
            ` : `
              <ul>
                <li>Full Store Management</li>
                <li>Unlimited Simple Products</li>
                <li>Order Management & Tracking</li>
                <li>Professional Templates</li>
              </ul>
            `}
            
            <p><a href="https://grabio.space/admin" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Go to Dashboard</a></p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Grabio Team</strong>
            </p>
          </div>
        </body>
      </html>
    `
  };
  
  await sendEmail(template);
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(email: string, type: string): Promise<void> {
  const template: EmailTemplate = {
    to: email,
    subject: 'Grabio Payment Failed - Action Required',
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626;">Payment Failed</h2>
            
            <p>We were unable to process your ${type} payment.</p>
            
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Please update your payment method and try again.</strong></p>
            </div>
            
            <p><a href="https://grabio.space/subscription" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Update Payment Method</a></p>
            
            <p>If you need help, please reply to this email.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Grabio Team</strong>
            </p>
          </div>
        </body>
      </html>
    `
  };
  
  await sendEmail(template);
}

/**
 * Send subscription expiring reminder (30 days before)
 */
export async function sendExpiringReminderEmail(
  email: string,
  daysRemaining: number,
  tier: string
): Promise<void> {
  const template: EmailTemplate = {
    to: email,
    subject: `Your Grabio Subscription Expires in ${daysRemaining} Days`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #f59e0b;">Subscription Expiring Soon</h2>
            
            <p>Your Grabio ${tier.toUpperCase()} subscription will expire in <strong>${daysRemaining} days</strong>.</p>
            
            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Don't lose access to your store!</strong></p>
              <p style="margin: 10px 0 0 0;">Renew now to continue using all features.</p>
            </div>
            
            <p><a href="https://grabio.space/subscription" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Renew Subscription</a></p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Grabio Team</strong>
            </p>
          </div>
        </body>
      </html>
    `
  };
  
  await sendEmail(template);
}

/**
 * Send grace period warning email
 */
export async function sendGracePeriodEmail(
  email: string,
  daysRemaining: number
): Promise<void> {
  const template: EmailTemplate = {
    to: email,
    subject: `URGENT: ${daysRemaining} Days Until Account Blocked`,
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626;">⚠️ Grace Period Active</h2>
            
            <p>Your subscription has expired. You have <strong>${daysRemaining} days</strong> remaining in your grace period.</p>
            
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Action Required!</strong></p>
              <p style="margin: 10px 0 0 0;">Renew now to avoid losing access to your store and data.</p>
            </div>
            
            <p><a href="https://grabio.space/subscription" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Renew Now</a></p>
            
            <p><strong>What happens after the grace period?</strong></p>
            <ul>
              <li>Your account will be blocked</li>
              <li>You'll lose access to your admin panel</li>
              <li>Data will be deleted after 30 days</li>
            </ul>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Grabio Team</strong>
            </p>
          </div>
        </body>
      </html>
    `
  };
  
  await sendEmail(template);
}

/**
 * Send expiry alert email to store owner listing expiring / expired stock items
 */
export async function sendExpiryAlertEmail(
  email: string,
  storeName: string,
  items: { name: string; type: string; expiryDate: string; daysLeft: number }[]
): Promise<void> {
  const expiredItems = items.filter(i => i.daysLeft < 0);
  const expiringSoonItems = items.filter(i => i.daysLeft >= 0);

  const buildRow = (item: { name: string; type: string; expiryDate: string; daysLeft: number }) => {
    const status = item.daysLeft < 0
      ? `<span style="color:#dc2626;font-weight:bold;">EXPIRED ${Math.abs(item.daysLeft)}d ago</span>`
      : `<span style="color:#ea580c;font-weight:bold;">Expires in ${item.daysLeft}d</span>`;
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;">${item.name}</td>
        <td style="padding:8px 12px;color:#6b7280;">${item.type}</td>
        <td style="padding:8px 12px;">${item.expiryDate}</td>
        <td style="padding:8px 12px;">${status}</td>
      </tr>`;
  };

  const template: EmailTemplate = {
    to: email,
    subject: `Stock Expiry Alert - ${expiredItems.length} expired, ${expiringSoonItems.length} expiring soon`,
    html: `
      <html>
        <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#dc2626;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="margin:0;font-size:24px;">Stock Expiry Alert</h1>
            <p style="margin:8px 0 0;">${storeName}</p>
          </div>
          <div style="background:#fafafa;padding:20px;border:1px solid #e5e7eb;">
            <p>Hi,</p>
            <p>The following stock items in your store <strong>${storeName}</strong> require attention:</p>
            ${expiredItems.length > 0 ? `<p style="color:#dc2626;font-weight:bold;">${expiredItems.length} item(s) have already EXPIRED.</p>` : ''}
            ${expiringSoonItems.length > 0 ? `<p style="color:#ea580c;font-weight:bold;">${expiringSoonItems.length} item(s) are expiring soon.</p>` : ''}
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:8px 12px;text-align:left;">Item</th>
                  <th style="padding:8px 12px;text-align:left;">Type</th>
                  <th style="padding:8px 12px;text-align:left;">Expiry Date</th>
                  <th style="padding:8px 12px;text-align:left;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(buildRow).join('')}
              </tbody>
            </table>
            <p style="margin-top:24px;">Please log in to your Grabio dashboard to take action on these items.</p>
            <p style="color:#6b7280;font-size:12px;margin-top:32px;">This is an automated daily notification from Grabio.</p>
          </div>
        </body>
      </html>
    `,
  };

  await sendEmail(template);
}

/**
 * Send order confirmation + tracking code to customer (guest or registered)
 */
export async function sendOrderConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  storeName: string;
  items: Array<{ name?: string; productId?: string; quantity: number; price: number }>;
  total: number;
  currency: string;
  deliveryAddress: string;
}): Promise<void> {
  const { to, customerName, orderId, storeName, items, total, currency, deliveryAddress } = params;
  const shortCode = orderId.slice(-8).toUpperCase();
  const trackUrl = `https://grabio.space/track/${orderId}`;

  const itemRows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#374151">${(i as Record<string, unknown>).name as string || i.productId || 'Item'} × ${i.quantity}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151">${currency} ${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  const template: EmailTemplate = {
    to,
    subject: `Order confirmed — your code is ${shortCode}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#38B2AC;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px">Order Confirmed ✅</h1>
    </div>
    <div style="padding:24px 32px">
      <p style="color:#374151;margin-top:0">Hi <strong>${customerName}</strong>,</p>
      <p style="color:#374151">Your order from <strong>${storeName}</strong> has been placed successfully.</p>

      <div style="background:#f0fdf4;border:1.5px solid #38B2AC;border-radius:10px;padding:16px;margin:20px 0;text-align:center">
        <p style="color:#6b7280;margin:0 0 6px 0;font-size:13px">Your order tracking code</p>
        <p style="font-size:30px;font-weight:700;color:#38B2AC;letter-spacing:5px;margin:0">${shortCode}</p>
        <p style="color:#9ca3af;font-size:11px;margin:8px 0 0 0">Enter this code in the Grabio app → Orders tab</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600">Item</th>
            <th style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280;font-weight:600">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td style="padding:10px 12px;font-weight:700;color:#111827">Total</td>
            <td style="padding:10px 12px;font-weight:700;color:#38B2AC;text-align:right">${currency} ${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <p style="color:#6b7280;font-size:13px;margin-bottom:20px"><strong>Delivery to:</strong> ${deliveryAddress}</p>

      <div style="text-align:center;margin:0 0 8px">
        <a href="${trackUrl}" style="background:#38B2AC;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block">
          Track My Order →
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center">© 2026 Grabio · grabio.space</p>
    </div>
  </div>
</body>
</html>`,
  };

  await sendEmail(template);
}
