import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

type ChecklistStatus = 'pass' | 'warn' | 'fail';

type ChecklistItem = {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
  action?: string;
};

type AuthContext = {
  storeId: string;
  uid: string;
};

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function resolveStoreAuth(req: Request): Promise<AuthContext> {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error('Missing bearer token');
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const requestedStoreId = String(req.body?.storeId || '').trim() || decoded.uid;

  if (decoded.uid !== requestedStoreId) {
    throw new Error('Unauthorized store access');
  }

  return {
    storeId: requestedStoreId,
    uid: decoded.uid,
  };
}

function buildCallbackBaseUrl(req: Request): string {
  const configured = String(process.env.API_BASE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const host = req.get('host') || 'us-central1-market-flow-7b074.cloudfunctions.net';
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';

  // In local emulator this resolves to localhost URL. In production it resolves to the deployed function host.
  return `${proto}://${host}`.replace(/\/$/, '');
}

function scoreStatus(status: ChecklistStatus): number {
  if (status === 'pass') return 2;
  if (status === 'warn') return 1;
  return 0;
}

export async function runWhishOpsChecklist(req: Request, res: Response): Promise<void> {
  try {
    const { storeId } = await resolveStoreAuth(req);
    const db = admin.firestore();

    const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!storeSnap.exists) {
      res.status(404).json({ success: false, message: 'Store profile not found' });
      return;
    }

    const storeData = storeSnap.data() || {};
    const gatewaySettings = (storeData.paymentGatewaySettings || {}) as { whishEnabled?: boolean };

    const whishChannel = String(storeData.whishChannel || '').trim();
    const whishSecret = String(storeData.whishSecret || '').trim();
    const websiteUrl = String(storeData.websiteUrl || '').trim();

    const callbackBase = buildCallbackBaseUrl(req);
    const expectedSuccessCallback = `${callbackBase}/payment/callback?externalId={externalId}&orderId={orderId}`;
    const expectedFailureCallback = `${callbackBase}/payment/callback?externalId={externalId}&orderId={orderId}&status=failed`;

    const looksLiveSecret = whishSecret.length >= 12 && !/(sandbox|test|demo)/i.test(whishSecret);
    const looksLiveChannel = whishChannel.length >= 4 && !/(sandbox|test|demo)/i.test(whishChannel);
    const hasHttpsWebsite = /^https:\/\//i.test(websiteUrl);
    const websiteLooksProduction = hasHttpsWebsite && !/localhost|127\.0\.0\.1/i.test(websiteUrl);

    const ordersSnap = await db
      .collection('orders')
      .where('storeId', '==', storeId)
      .limit(100)
      .get();

    const whishOrders = ordersSnap.docs
      .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: doc.id, ...(doc.data() || {}) } as Record<string, unknown>))
      .filter((order: Record<string, unknown>) => {
        const gateway = String(order.paymentGateway || order.paymentMethod || '').toLowerCase();
        return gateway === 'whish';
      });

    const paidWhishOrders = whishOrders.filter((order: Record<string, unknown>) => String(order.paymentStatus || '').toLowerCase() === 'paid');
    const failedWhishOrders = whishOrders.filter((order: Record<string, unknown>) => {
      const status = String(order.paymentStatus || '').toLowerCase();
      return status.includes('fail') || status.includes('cancel');
    });

    const finalizedPaidOrders = paidWhishOrders.filter((order: Record<string, unknown>) => Boolean(order.inventoryDeductedAt));

    const checklist: ChecklistItem[] = [
      {
        id: 'gateway-enabled',
        label: 'Whish gateway is enabled in gateway control center',
        status: gatewaySettings.whishEnabled === false ? 'fail' : 'pass',
        detail: gatewaySettings.whishEnabled === false ? 'Whish is currently disabled for checkout.' : 'Whish gateway is enabled.',
        action: gatewaySettings.whishEnabled === false ? 'Enable Whish in Admin > Gateway Control Center.' : undefined,
      },
      {
        id: 'credentials-present',
        label: 'Whish channel + secret + website URL are configured',
        status: whishChannel && whishSecret && websiteUrl ? 'pass' : 'fail',
        detail: whishChannel && whishSecret && websiteUrl
          ? 'All required Whish credentials are present.'
          : 'One or more Whish credentials are missing.',
        action: whishChannel && whishSecret && websiteUrl ? undefined : 'Fill all Whish credentials in Admin > Payment Credentials.',
      },
      {
        id: 'live-credentials-check',
        label: 'Credentials look like production (not sandbox/test)',
        status: looksLiveSecret && looksLiveChannel ? 'pass' : 'warn',
        detail: looksLiveSecret && looksLiveChannel
          ? 'Channel and secret format look production-ready.'
          : 'Channel or secret may still be sandbox/test values.',
        action: looksLiveSecret && looksLiveChannel ? undefined : 'Replace sandbox credentials with live Whish credentials.',
      },
      {
        id: 'website-production-url',
        label: 'Website URL is HTTPS and non-localhost',
        status: websiteLooksProduction ? 'pass' : 'warn',
        detail: websiteLooksProduction
          ? `Website URL is set to ${websiteUrl}.`
          : `Current URL (${websiteUrl || 'empty'}) may not be production-safe.`,
        action: websiteLooksProduction ? undefined : 'Set Website URL to your public HTTPS domain.',
      },
      {
        id: 'callback-reference',
        label: 'Production callback URL references are available',
        status: 'pass',
        detail: `Use success callback: ${expectedSuccessCallback} | failure callback: ${expectedFailureCallback}`,
      },
      {
        id: 'paid-flow-validation',
        label: 'At least one successful Whish payment exists',
        status: paidWhishOrders.length > 0 ? 'pass' : 'warn',
        detail: paidWhishOrders.length > 0
          ? `${paidWhishOrders.length} paid Whish order(s) detected.`
          : 'No paid Whish orders detected yet.',
        action: paidWhishOrders.length > 0 ? undefined : 'Run a real production payment success test.',
      },
      {
        id: 'failure-flow-validation',
        label: 'Failure/cancel payment flow observed at least once',
        status: failedWhishOrders.length > 0 ? 'pass' : 'warn',
        detail: failedWhishOrders.length > 0
          ? `${failedWhishOrders.length} failed/canceled Whish order(s) detected.`
          : 'No failed/canceled Whish orders detected yet.',
        action: failedWhishOrders.length > 0 ? undefined : 'Run a cancellation/failure smoke test to validate fallback behavior.',
      },
      {
        id: 'order-finalization',
        label: 'Paid Whish orders trigger inventory/order finalization',
        status: paidWhishOrders.length === 0 ? 'warn' : finalizedPaidOrders.length === paidWhishOrders.length ? 'pass' : 'warn',
        detail: paidWhishOrders.length === 0
          ? 'No paid orders available to verify finalization.'
          : `${finalizedPaidOrders.length}/${paidWhishOrders.length} paid Whish order(s) have inventory deduction markers.`,
        action: paidWhishOrders.length === 0 || finalizedPaidOrders.length < paidWhishOrders.length
          ? 'Verify callback handling and inventory deduction for recent paid Whish orders.'
          : undefined,
      },
    ];

    const totalScore = checklist.reduce((sum, item) => sum + scoreStatus(item.status), 0);
    const maxScore = checklist.length * 2;
    const overallStatus: ChecklistStatus = checklist.some((item) => item.status === 'fail')
      ? 'fail'
      : checklist.some((item) => item.status === 'warn')
        ? 'warn'
        : 'pass';

    res.json({
      success: true,
      overallStatus,
      score: {
        value: totalScore,
        max: maxScore,
        percentage: Math.round((totalScore / maxScore) * 100),
      },
      checklist,
      stats: {
        totalWhishOrders: whishOrders.length,
        paidWhishOrders: paidWhishOrders.length,
        failedWhishOrders: failedWhishOrders.length,
        finalizedPaidOrders: finalizedPaidOrders.length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to run Whish ops checklist';
    const status = message.includes('Unauthorized') ? 403 : message.includes('Missing bearer token') ? 401 : 500;
    res.status(status).json({ success: false, message });
  }
}
