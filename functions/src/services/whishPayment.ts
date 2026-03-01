import axios from 'axios';

const WHISH_CONFIG = {
  channel: '10198838',
  secret: '009ca52d70e54fe0971b9143fe3e2b3a',
  websiteUrl: 'aynbeirut.com',
  baseUrl: 'https://api.whish.money/itel-service/api', // Production
  // sandboxUrl: 'https://api.sandbox.whish.money/itel-service/api', // For testing
  userAgent: 'Whish/1.0 (https://whish.money; support@whish.money)'
};

export interface WhishPaymentRequest {
  amount: number; // In USD (e.g., 10.00 for $10)
  currency: 'USD' | 'LBP';
  invoice: string; // Description/Details about the payment
  externalId: number; // Unique numeric ID from our system
  successCallbackUrl: string; // GET callback for success
  failureCallbackUrl: string; // GET callback for failure
  successRedirectUrl: string; // Redirect user after success
  failureRedirectUrl: string; // Redirect user after failure
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
        headers: {
          'Content-Type': 'application/json',
          'channel': WHISH_CONFIG.channel,
          'secret': WHISH_CONFIG.secret,
          'websiteUrl': WHISH_CONFIG.websiteUrl,
          'User-Agent': WHISH_CONFIG.userAgent
        },
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
        headers: {
          'Content-Type': 'application/json',
          'channel': WHISH_CONFIG.channel,
          'secret': WHISH_CONFIG.secret,
          'websiteUrl': WHISH_CONFIG.websiteUrl,
          'User-Agent': WHISH_CONFIG.userAgent
        },
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
        headers: {
          'channel': WHISH_CONFIG.channel,
          'secret': WHISH_CONFIG.secret,
          'websiteUrl': WHISH_CONFIG.websiteUrl,
          'User-Agent': WHISH_CONFIG.userAgent
        },
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
