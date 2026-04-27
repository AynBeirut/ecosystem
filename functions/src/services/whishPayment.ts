import axios from 'axios';

const WHISH_CONFIG = {
  channel: String(process.env.WHISH_CHANNEL || '').trim(),
  secret: String(process.env.WHISH_SECRET || '').trim(),
  defaultWebsiteUrl: process.env.WHISH_WEBSITE_URL || 'grabio.space', // Default domain; overridden per-request
  baseUrl: process.env.WHISH_BASE_URL || 'https://api.whish.money/itel-service/api',
  userAgent: 'Whish/1.0 (https://whish.money; support@whish.money)'
};

function getWhishHeaders(websiteUrl: string) {
  if (!WHISH_CONFIG.channel || !WHISH_CONFIG.secret) {
    throw new Error('Whish credentials are not configured: set WHISH_CHANNEL and WHISH_SECRET');
  }

  return {
    'Content-Type': 'application/json',
    channel: WHISH_CONFIG.channel,
    secret: WHISH_CONFIG.secret,
    websiteUrl,
    'User-Agent': WHISH_CONFIG.userAgent,
  };
}

/** Allowed merchant domains — both should be registered with Whish (ask Steven to whitelist both) */
const ALLOWED_WHISH_DOMAINS = ['grabio.space', 'aynbeirut.com'];

/** Extract a clean hostname from an origin/referer value, defaulting to grabio.space */
export function resolveWebsiteUrl(origin?: string): string {
  if (!origin) return WHISH_CONFIG.defaultWebsiteUrl;
  try {
    const url = new URL(origin.startsWith('http') ? origin : `https://${origin}`);
    const host = url.hostname.replace(/^www\./, '');
    return ALLOWED_WHISH_DOMAINS.includes(host) ? host : WHISH_CONFIG.defaultWebsiteUrl;
  } catch {
    return WHISH_CONFIG.defaultWebsiteUrl;
  }
}

export interface WhishPaymentRequest {
  amount: number; // In USD (e.g., 10.00 for $10)
  currency: 'USD' | 'LBP';
  invoice: string; // Description/Details about the payment
  externalId: number; // Unique numeric ID from our system
  successCallbackUrl: string; // GET callback for success
  failureCallbackUrl: string; // GET callback for failure
  successRedirectUrl: string; // Redirect user after success
  failureRedirectUrl: string; // Redirect user after failure
  websiteUrl?: string; // Optional: override domain (grabio.space or aynbeirut.com)
}

export interface WhishPaymentResponse {
  status: boolean;
  code?: string | null;
  dialog?: any;
  data?: {
    collectUrl?: string; // The payment page URL
  };
  error?: string;
}

export interface WhishStatusRequest {
  currency: 'USD' | 'LBP';
  externalId: number;
}

export interface WhishStatusResponse {
  status: boolean;
  code?: string | null;
  data?: {
    collectStatus: 'success' | 'failed' | 'pending';
    payerPhoneNumber?: string;
  };
}

/**
 * Initialize a payment with Whish Money
 * Returns a collectUrl where the user should be redirected to complete payment
 */
export async function initiatePayment(
  request: WhishPaymentRequest
): Promise<WhishPaymentResponse> {
  try {
    console.log('Initiating Whish payment:', {
      amount: request.amount,
      currency: request.currency,
      externalId: request.externalId
    });

    const response = await axios.post<WhishPaymentResponse>(
      `${WHISH_CONFIG.baseUrl}/payment/whish`,
      {
        amount: request.amount,
        currency: request.currency,
        invoice: request.invoice,
        externalId: request.externalId,
        successCallbackUrl: request.successCallbackUrl,
        failureCallbackUrl: request.failureCallbackUrl,
        successRedirectUrl: request.successRedirectUrl,
        failureRedirectUrl: request.failureRedirectUrl
      },
      {
        headers: getWhishHeaders(request.websiteUrl || WHISH_CONFIG.defaultWebsiteUrl),
        timeout: 30000 // 30 second timeout
      }
    );

    console.log('Whish payment response:', response.data);

    if (response.data.status && response.data.data?.collectUrl) {
      return {
        status: true,
        data: {
          collectUrl: response.data.data.collectUrl
        }
      };
    }

    // Handle failure
    return {
      status: false,
      code: response.data.code || 'UNKNOWN_ERROR',
      error: response.data.dialog?.message || 'Payment initiation failed'
    };
  } catch (error: any) {
    console.error('Whish payment error:', error.response?.data || error.message);
    return {
      status: false,
      error: error.response?.data?.dialog?.message || error.message || 'Payment service unavailable'
    };
  }
}

/**
 * Check payment status using externalId
 */
export async function checkPaymentStatus(
  externalId: number,
  currency: 'USD' | 'LBP' = 'USD'
): Promise<WhishStatusResponse> {
  try {
    console.log('Checking payment status:', { externalId, currency });

    const response = await axios.post<WhishStatusResponse>(
      `${WHISH_CONFIG.baseUrl}/payment/collect/status`,
      {
        currency,
        externalId
      },
      {
        headers: getWhishHeaders(WHISH_CONFIG.defaultWebsiteUrl),
        timeout: 30000
      }
    );

    console.log('Whish status response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Whish status check error:', error.response?.data || error.message);
    return {
      status: false,
      code: error.response?.data?.code || 'STATUS_CHECK_ERROR'
    };
  }
}

/**
 * Get account balance
 */
export async function getBalance(currency: 'USD' | 'LBP' = 'USD'): Promise<number | null> {
  try {
    const response = await axios.get(
      `${WHISH_CONFIG.baseUrl}/payment/account/balance`,
      {
        params: { currency },
        headers: getWhishHeaders(WHISH_CONFIG.defaultWebsiteUrl),
        timeout: 30000
      }
    );

    if (response.data.status && response.data.data?.balance !== undefined) {
      return response.data.data.balance;
    }
    return null;
  } catch (error: any) {
    console.error('Whish balance check error:', error.response?.data || error.message);
    return null;
  }
}
