import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import axios from 'axios';

const PROJECT_ID = 'market-flow-7b074';
const SITE_ID = 'market-flow-7b074';
// Basic domain validation: at least one dot, no spaces, no scheme
const DOMAIN_REGEX = /^(?!https?:\/\/)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function mapHostingDomainStatus(payload: unknown): 'active' | 'pending' | 'error' {
  const raw = JSON.stringify(payload).toUpperCase();

  if (
    raw.includes('"ACTIVE"') ||
    raw.includes('CERT_ACTIVE') ||
    raw.includes('DOMAIN_ACTIVE') ||
    raw.includes('PROVISIONED')
  ) {
    return 'active';
  }

  if (raw.includes('FAILED') || raw.includes('ERROR') || raw.includes('INVALID')) {
    return 'error';
  }

  return 'pending';
}

export async function registerCustomDomain(req: Request, res: Response): Promise<void> {
  const { storeId, customDomain } = req.body as { storeId?: string; customDomain?: string };

  if (!storeId || typeof storeId !== 'string') {
    res.status(400).json({ message: 'storeId is required' });
    return;
  }
  if (!customDomain || typeof customDomain !== 'string' || !DOMAIN_REGEX.test(customDomain)) {
    res.status(400).json({ message: 'Invalid domain name' });
    return;
  }

  const db = admin.firestore();

  try {
    // Verify the store exists
    const storeRef = db.collection('storeProfiles').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists()) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }

    // Save the customDomain and mark as pending in Firestore first
    await storeRef.update({
      customDomain: customDomain.toLowerCase(),
      customDomainStatus: 'pending',
    });

    // Get an access token from the default credentials (Firebase Admin service account)
    const credential = admin.app().options.credential;
    if (!credential) {
      // If no credential available (emulator), just return pending
      res.json({ success: true, status: 'pending', message: 'Domain saved (credential unavailable in emulator)' });
      return;
    }

    let accessToken: string;
    try {
      const cred = credential as { getAccessToken(): Promise<{ access_token: string }> };
      const tokenResult = await cred.getAccessToken();
      accessToken = tokenResult.access_token;
    } catch (_tokenErr) {
      // Running locally or no valid credential — skip hosting API call
      res.json({ success: true, status: 'pending', message: 'Domain saved; skipping Hosting API in local mode.' });
      return;
    }

    // Call Firebase Hosting Management API to register custom domain
    const hostingApiUrl =
      `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/domains`;
    try {
      await axios.post(
        hostingApiUrl,
        { domainName: customDomain.toLowerCase(), site: `sites/${SITE_ID}` },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (apiErr: unknown) {
      if (axios.isAxiosError(apiErr)) {
        const status = apiErr.response?.status;
        const msg = apiErr.response?.data?.error?.message || apiErr.message;
        // 409 = already exists; treat as success
        if (status !== 409) {
          console.error('[registerCustomDomain] Hosting API error:', msg);
          // Still saved to Firestore — return partial success with the API error
          res.status(500).json({
            success: false,
            message: `Domain saved but Hosting API returned: ${msg}`,
          });
          return;
        }
      }
    }

    res.json({ success: true, status: 'pending', message: 'Custom domain registered. DNS setup required.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[registerCustomDomain]', err);
    res.status(500).json({ success: false, message: msg });
  }
}

export async function checkCustomDomainStatus(req: Request, res: Response): Promise<void> {
  const { storeId, customDomain } = req.body as { storeId?: string; customDomain?: string };

  if (!storeId || typeof storeId !== 'string') {
    res.status(400).json({ message: 'storeId is required' });
    return;
  }
  if (!customDomain || typeof customDomain !== 'string' || !DOMAIN_REGEX.test(customDomain)) {
    res.status(400).json({ message: 'Invalid domain name' });
    return;
  }

  const normalizedDomain = customDomain.toLowerCase();
  const db = admin.firestore();

  try {
    const storeRef = db.collection('storeProfiles').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists()) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }

    const credential = admin.app().options.credential;
    if (!credential) {
      res.json({ success: true, status: 'pending', message: 'Credential unavailable in emulator mode.' });
      return;
    }

    let accessToken: string;
    try {
      const cred = credential as { getAccessToken(): Promise<{ access_token: string }> };
      const tokenResult = await cred.getAccessToken();
      accessToken = tokenResult.access_token;
    } catch (_tokenErr) {
      res.json({ success: true, status: 'pending', message: 'Skipped Hosting API call in local mode.' });
      return;
    }

    const hostingApiUrl =
      `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/domains/${encodeURIComponent(normalizedDomain)}`;

    let status: 'active' | 'pending' | 'error' = 'pending';
    let apiMessage = 'Domain status fetched.';

    try {
      const response = await axios.get(hostingApiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      status = mapHostingDomainStatus(response.data);
    } catch (apiErr: unknown) {
      if (axios.isAxiosError(apiErr)) {
        const responseStatus = apiErr.response?.status;
        const msg = apiErr.response?.data?.error?.message || apiErr.message;
        apiMessage = msg;

        if (responseStatus === 404) {
          status = 'pending';
        } else {
          status = 'error';
        }
      } else {
        status = 'error';
      }
    }

    await storeRef.update({
      customDomain: normalizedDomain,
      customDomainStatus: status,
    });

    res.json({ success: true, status, message: apiMessage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[checkCustomDomainStatus]', err);
    res.status(500).json({ success: false, message: msg });
  }
}
