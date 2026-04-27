import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import axios from 'axios';

const PROJECT_ID = 'market-flow-7b074';
const SITE_ID = 'market-flow-7b074';
// Basic domain validation: at least one dot, no spaces, no scheme
const DOMAIN_REGEX = /^(?!https?:\/\/)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

type StatusValue = 'active' | 'pending' | 'error';

type DomainDnsRecord = {
  type: string;
  name: string;
  value: string;
  status: 'verified' | 'pending';
};

type DomainStatusDetails = {
  domainStatus: StatusValue;
  sslStatus: StatusValue;
  dnsRecords: DomainDnsRecord[];
};

function toStatusValue(raw: string | undefined): StatusValue {
  const upper = (raw || '').toUpperCase();
  if (!upper) return 'pending';
  if (upper.includes('ACTIVE') || upper.includes('PROVISIONED') || upper.includes('CONNECTED') || upper.includes('MATCH')) {
    return 'active';
  }
  if (upper.includes('FAILED') || upper.includes('ERROR') || upper.includes('INVALID')) {
    return 'error';
  }
  return 'pending';
}

function getDefaultDnsRecords(customDomain: string): DomainDnsRecord[] {
  const segments = customDomain.split('.');
  const subdomain = segments.length > 2 ? segments[0] : '@';

  return [{
    type: 'CNAME',
    name: subdomain,
    value: `${PROJECT_ID}.web.app`,
    status: 'pending',
  }];
}

function extractDomainStatusDetails(payload: unknown, customDomain: string, fallbackStatus: StatusValue): DomainStatusDetails {
  const data = (payload || {}) as {
    provisioning?: { status?: string; certStatus?: string };
    domainName?: string;
    requiredDnsUpdates?: {
      desired?: Array<{ domainName?: string; type?: string; rrdatas?: string[] }>;
      discovered?: Array<{ domainName?: string; type?: string; rrdatas?: string[] }>;
    };
  };

  const domainStatus = toStatusValue(data.provisioning?.status) || fallbackStatus;
  const sslStatus = toStatusValue(data.provisioning?.certStatus);

  const desiredRecords = Array.isArray(data.requiredDnsUpdates?.desired)
    ? data.requiredDnsUpdates?.desired
    : [];
  const discoveredRecords = Array.isArray(data.requiredDnsUpdates?.discovered)
    ? data.requiredDnsUpdates?.discovered
    : [];

  const normalizedDesired: DomainDnsRecord[] = desiredRecords
    .filter((entry) => typeof entry?.type === 'string' && typeof entry?.domainName === 'string')
    .map((entry) => ({
      type: String(entry.type || 'CNAME').toUpperCase(),
      name: String(entry.domainName || customDomain),
      value: Array.isArray(entry.rrdatas) && entry.rrdatas.length > 0 ? String(entry.rrdatas[0]) : `${PROJECT_ID}.web.app`,
      status: 'pending' as const,
    }));

  const normalizedDiscovered = discoveredRecords
    .filter((entry) => typeof entry?.type === 'string' && typeof entry?.domainName === 'string')
    .map((entry) => ({
      type: String(entry.type || 'CNAME').toUpperCase(),
      name: String(entry.domainName || customDomain),
      value: Array.isArray(entry.rrdatas) && entry.rrdatas.length > 0 ? String(entry.rrdatas[0]) : '',
    }));

  const dnsRecords = (normalizedDesired.length > 0 ? normalizedDesired : getDefaultDnsRecords(customDomain)).map((record) => {
    const isMatched = normalizedDiscovered.some(
      (discovered) =>
        discovered.type === record.type &&
        discovered.name.toLowerCase() === record.name.toLowerCase() &&
        discovered.value.toLowerCase() === record.value.toLowerCase(),
    );

    return {
      ...record,
      status: (isMatched ? 'verified' : 'pending') as 'verified' | 'pending',
    };
  });

  return {
    domainStatus: fallbackStatus === 'active' ? 'active' : domainStatus,
    sslStatus: fallbackStatus === 'active' ? 'active' : sslStatus,
    dnsRecords,
  };
}

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
      res.json({
        success: true,
        status: 'pending',
        message: 'Credential unavailable in emulator mode.',
        details: {
          domainStatus: 'pending',
          sslStatus: 'pending',
          dnsRecords: getDefaultDnsRecords(normalizedDomain),
        },
      });
      return;
    }

    let accessToken: string;
    try {
      const cred = credential as { getAccessToken(): Promise<{ access_token: string }> };
      const tokenResult = await cred.getAccessToken();
      accessToken = tokenResult.access_token;
    } catch (_tokenErr) {
      res.json({
        success: true,
        status: 'pending',
        message: 'Skipped Hosting API call in local mode.',
        details: {
          domainStatus: 'pending',
          sslStatus: 'pending',
          dnsRecords: getDefaultDnsRecords(normalizedDomain),
        },
      });
      return;
    }

    const hostingApiUrl =
      `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/domains/${encodeURIComponent(normalizedDomain)}`;

    let status: StatusValue = 'pending';
    let apiMessage = 'Domain status fetched.';
    let details: DomainStatusDetails = {
      domainStatus: 'pending',
      sslStatus: 'pending',
      dnsRecords: getDefaultDnsRecords(normalizedDomain),
    };

    try {
      const response = await axios.get(hostingApiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      status = mapHostingDomainStatus(response.data);
      details = extractDomainStatusDetails(response.data, normalizedDomain, status);
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

      details = {
        domainStatus: status,
        sslStatus: status === 'error' ? 'error' : 'pending',
        dnsRecords: getDefaultDnsRecords(normalizedDomain),
      };
    }

    await storeRef.update({
      customDomain: normalizedDomain,
      customDomainStatus: status,
    });

    res.json({ success: true, status, message: apiMessage, details });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[checkCustomDomainStatus]', err);
    res.status(500).json({ success: false, message: msg });
  }
}
