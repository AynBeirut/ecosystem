import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import axios from 'axios';
import { activateRecurringServiceSubscriptionsFromOrder } from '../services/orderSubscriptions';

const db = admin.firestore();

interface WhishCredentials {
  whishChannel: string;
  whishSecret: string;
  websiteUrl: string;
}

interface WhishPaymentResponse {
  status: boolean;
  code?: string | null;
  dialog?: any;
  data?: {
    collectUrl?: string;
  };
  error?: string;
}

/**
 * Initialize payment using store owner's Whish Money credentials
 */
async function initiateStorePayment(
  credentials: WhishCredentials,
  amount: number,
  invoice: string,
  externalId: number,
  successCallbackUrl: string,
  failureCallbackUrl: string,
  successRedirectUrl: string,
  failureRedirectUrl: string
): Promise<WhishPaymentResponse> {
  try {
    console.log('Initiating store payment:', {
      amount,
      externalId,
      channel: credentials.whishChannel
    });

    const response = await axios.post<WhishPaymentResponse>(
      'https://api.whish.money/itel-service/api/payment/whish',
      {
        amount,
        currency: 'USD',
        invoice,
        externalId,
        successCallbackUrl,
        failureCallbackUrl,
        successRedirectUrl,
        failureRedirectUrl
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'channel': credentials.whishChannel,
          'secret': credentials.whishSecret,
          'websiteUrl': credentials.websiteUrl,
          'User-Agent': 'Whish/1.0 (https://whish.money; support@whish.money)'
        },
        timeout: 30000
      }
    );

    console.log('Store payment response:', response.data);

    if (response.data.status && response.data.data?.collectUrl) {
      return {
        status: true,
        data: {
          collectUrl: response.data.data.collectUrl
        }
      };
    }

    return {
      status: false,
      code: response.data.code || 'UNKNOWN_ERROR',
      error: response.data.dialog?.message || 'Payment initiation failed'
    };
  } catch (error: any) {
    console.error('Store payment error:', error.response?.data || error.message);
    return {
      status: false,
      error: error.response?.data?.dialog?.message || error.message || 'Payment service unavailable'
    };
  }
}

/**
 * Check payment status using store owner's credentials
 */
async function checkStorePaymentStatus(
  credentials: WhishCredentials,
  externalId: number
): Promise<{ status: boolean; collectStatus?: string; error?: string }> {
  try {
    console.log('Checking store payment status:', { externalId });

    const response = await axios.post(
      'https://api.whish.money/itel-service/api/payment/collect/status',
      {
        currency: 'USD',
        externalId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'channel': credentials.whishChannel,
          'secret': credentials.whishSecret,
          'websiteUrl': credentials.websiteUrl,
          'User-Agent': 'Whish/1.0 (https://whish.money; support@whish.money)'
        },
        timeout: 30000
      }
    );

    console.log('Store payment status response:', response.data);
    
    return {
      status: response.data.status,
      collectStatus: response.data.data?.collectStatus,
      error: response.data.dialog?.message
    };
  } catch (error: any) {
    console.error('Store payment status error:', error.response?.data || error.message);
    return {
      status: false,
      error: error.message
    };
  }
}

/**
 * Process checkout - Create payment for an existing order
 */
export async function processCheckout(req: Request, res: Response) {
  try {
    const { orderId } = req.body;

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({ error: 'Missing order ID' });
    }

    // Get order details
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderSnap.data();
    const storeId = orderData?.storeId;
    const totalAmount = orderData?.total;
    const items = orderData?.items || [];

    if (!storeId || !totalAmount) {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    // Get store's Whish Money credentials
    const storeRef = db.collection('storeProfiles').doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const storeData = storeSnap.data();
    const credentials: WhishCredentials = {
      whishChannel: storeData?.whishChannel,
      whishSecret: storeData?.whishSecret,
      websiteUrl: storeData?.websiteUrl
    };

    // Validate store has payment credentials configured
    if (!credentials.whishChannel || !credentials.whishSecret || !credentials.websiteUrl) {
      return res.status(400).json({ 
        error: 'Store has not configured payment credentials',
        details: 'Store owner must add Whish Money credentials in Admin > Payments'
      });
    }

    // Generate unique external ID for this payment
    const externalId = Date.now();
    
    // Convert total to cents
    const amountInCents = Math.round(totalAmount * 100);

    // Create invoice description from order items
    const itemsSummary = items.length > 0 
      ? items.map((item: any) => `${item.productId} x${item.quantity}`).join(', ')
      : 'Order items';
    const invoice = `Order #${orderId}: ${itemsSummary}`;

    // Update order with payment info
    await orderRef.update({
      externalId,
      paymentStatus: 'pending',
      updatedAt: new Date().toISOString()
    });

    // Get store name/slug for redirects
    const storeName = storeData?.storeName || 'store';
    const storeSlug = storeData?.slug || storeId;

    // Initialize payment with store owner's Whish Money account
    const payment = await initiateStorePayment(
      credentials,
      amountInCents,
      invoice,
      externalId,
      `https://us-central1-market-flow-7b074.cloudfunctions.net/api/payment/callback?externalId=${externalId}&orderId=${orderId}`,
      `https://us-central1-market-flow-7b074.cloudfunctions.net/api/payment/callback?externalId=${externalId}&orderId=${orderId}&status=failed`,
      `https://grabio.space/${storeSlug}?order=success&orderId=${orderId}`,
      `https://grabio.space/${storeSlug}?order=failed&orderId=${orderId}`
    );

    if (!payment.status || !payment.data?.collectUrl) {
      // Update order to show payment init failed
      await orderRef.update({
        paymentStatus: 'failed',
        paymentError: payment.error || 'Payment initialization failed',
        updatedAt: new Date().toISOString()
      });
      
      return res.status(500).json({ 
        error: payment.error || 'Payment initialization failed',
        details: 'Unable to create payment with store\'s Whish Money account'
      });
    }

    res.json({
      success: true,
      paymentUrl: payment.data.collectUrl,
      orderId,
      externalId
    });
  } catch (error: any) {
    console.error('Checkout payment error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle payment callback from Whish Money
 */
export async function handleCheckoutCallback(req: Request, res: Response) {
  try {
    const { externalId, orderId, status } = req.query;

    console.log('Payment callback received:', { externalId, orderId, status });

    if (!externalId || !orderId) {
      return res.status(400).send('Missing required parameters');
    }

    const orderRef = db.collection('orders').doc(orderId as string);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).send('Order not found');
    }

    const orderData = orderSnap.data();
    const storeId = orderData?.storeId;

    // Get store credentials to check payment status
    const storeRef = db.collection('storeProfiles').doc(storeId);
    const storeSnap = await storeRef.get();
    
    if (!storeSnap.exists) {
      return res.status(404).send('Store not found');
    }

    const storeData = storeSnap.data();
    const storeSlug = storeData?.slug || storeId;
    
    const credentials: WhishCredentials = {
      whishChannel: storeData?.whishChannel,
      whishSecret: storeData?.whishSecret,
      websiteUrl: storeData?.websiteUrl
    };

    // If explicitly marked as failed
    if (status === 'failed') {
      await orderRef.update({
        status: 'payment_failed',
        paymentStatus: 'failed',
        paymentFailedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      return res.redirect(`https://grabio.space/${storeSlug}?order=failed&orderId=${orderId}`);
    }

    // Verify payment status with Whish Money
    const statusCheck = await checkStorePaymentStatus(
      credentials,
      parseInt(externalId as string)
    );

    if (statusCheck.status && statusCheck.collectStatus === 'success') {
      // Payment confirmed - update order status to paid
      const total = Number(orderData?.total || 0);
      await orderRef.update({
        status: 'paid',
        paymentStatus: 'paid',
        amountPaid: Number.isFinite(total) ? total : 0,
        paymentDate: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await activateRecurringServiceSubscriptionsFromOrder(String(orderId));

      // Redirect to success page
      return res.redirect(`https://grabio.space/${storeSlug}?order=success&orderId=${orderId}`);
    } else if (statusCheck.collectStatus === 'failed') {
      // Payment failed
      await orderRef.update({
        status: 'payment_failed',
        paymentStatus: 'failed',
        paymentFailedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return res.redirect(`https://grabio.space/${storeSlug}?order=failed&orderId=${orderId}`);
    } else {
      // Payment still pending
      console.log('Payment still pending:', { externalId, orderId });
      return res.status(202).send('Payment pending - please wait');
    }
  } catch (error: any) {
    console.error('Payment callback error:', error);
    res.status(500).send('Callback processing failed');
  }
}
