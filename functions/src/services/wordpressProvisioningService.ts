import * as admin from 'firebase-admin';
import { createHash, randomBytes } from 'crypto';
import {
  createWebuzoFtpAccount,
  createWebuzoUser,
  getWebuzoPublicEndpoints,
  isWebuzoConfigured,
} from './webuzoClient';
import { sendWordPressAccessEmail } from './emailService';

const db = admin.firestore();
const SECRETS_COLLECTION = 'wordpressProvisioningSecrets';
const TOKENS_COLLECTION = 'wordpressAccessTokens';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type WordPressRequestDoc = {
  storeId: string;
  ownerUid: string;
  businessName: string;
  contactEmail: string;
  preferredDomain?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type WordPressProvisioningSecrets = {
  requestId: string;
  webuzoUsername: string;
  webuzoPassword: string;
  ftpUsername: string;
  ftpPassword: string;
  hostingDomain: string;
  ftpHost: string;
  panelUrl: string;
  createdAt: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12);
}

function normalizeDomain(raw?: string | null): string {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
  if (!value || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) {
    throw new Error('A valid preferred domain is required for WordPress provisioning');
  }
  return value;
}

function deriveUsername(domain: string, businessName: string): string {
  const domainPart = slugify(domain.split('.')[0] || 'site');
  const businessPart = slugify(businessName);
  const base = (domainPart || businessPart || 'site').slice(0, 10);
  const suffix = randomBytes(2).toString('hex');
  return `${base}${suffix}`.slice(0, 12);
}

function generatePassword(): string {
  const raw = randomBytes(18).toString('base64url');
  return `Gz${raw}!9`.slice(0, 20);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicAppUrl(): string {
  return String(process.env.PUBLIC_APP_URL || 'https://grabio.space').replace(/\/$/, '');
}

async function storeAccessArtifacts(
  requestId: string,
  secrets: WordPressProvisioningSecrets,
): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();

  await db.collection(SECRETS_COLLECTION).doc(requestId).set(secrets);
  await db.collection(TOKENS_COLLECTION).doc(tokenHash).set({
    requestId,
    expiresAt,
    createdAt: now.toISOString(),
    redeemedAt: null,
  });

  return token;
}

export async function provisionWordPressRequest(
  requestId: string,
  data: WordPressRequestDoc,
): Promise<void> {
  if (data.status !== 'pending') return;

  const requestRef = db.collection('wordpressProvisioningRequests').doc(requestId);
  const now = new Date().toISOString();

  if (!isWebuzoConfigured()) {
    await requestRef.set(
      {
        status: 'failed',
        provisionError: 'Webuzo API is not configured on Cloud Functions',
        updatedAt: now,
      },
      { merge: true },
    );
    return;
  }

  await requestRef.set({ status: 'in_progress', updatedAt: now, provisionError: null }, { merge: true });

  try {
    const hostingDomain = normalizeDomain(data.preferredDomain);
    const webuzoUsername = deriveUsername(hostingDomain, data.businessName);
    const webuzoPassword = generatePassword();
    const ftpPassword = generatePassword();
    const ftpUsername = `${webuzoUsername}ftp`.slice(0, 16);

    await createWebuzoUser({
      username: webuzoUsername,
      domain: hostingDomain,
      email: data.contactEmail,
      password: webuzoPassword,
    });

    await createWebuzoFtpAccount({
      accountUser: webuzoUsername,
      accountPass: webuzoPassword,
      login: ftpUsername,
      password: ftpPassword,
      domain: hostingDomain,
    });

    const endpoints = getWebuzoPublicEndpoints(hostingDomain);
    const secrets: WordPressProvisioningSecrets = {
      requestId,
      webuzoUsername,
      webuzoPassword,
      ftpUsername,
      ftpPassword,
      hostingDomain,
      ftpHost: endpoints.ftpHost,
      panelUrl: endpoints.panelUrl,
      createdAt: now,
    };

    const accessToken = await storeAccessArtifacts(requestId, secrets);
    const accessUrl = `${publicAppUrl()}/wordpress/access?token=${encodeURIComponent(accessToken)}`;

    await sendWordPressAccessEmail({
      to: data.contactEmail,
      businessName: data.businessName,
      domain: hostingDomain,
      webuzoUsername,
      ftpUsername,
      ftpHost: endpoints.ftpHost,
      accessUrl,
    });

    await requestRef.set(
      {
        status: 'completed',
        completedAt: now,
        provisionedAt: now,
        accessEmailSentAt: now,
        webuzoUsername,
        hostingDomain,
        ftpUsername,
        ftpHost: endpoints.ftpHost,
        panelUrl: endpoints.panelUrl,
        provisionError: null,
        updatedAt: now,
      },
      { merge: true },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WordPress provisioning failed';
    console.error('[provisionWordPressRequest]', requestId, message);
    await requestRef.set(
      {
        status: 'failed',
        provisionError: message,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }
}

export async function redeemWordPressAccessToken(token: string): Promise<WordPressProvisioningSecrets> {
  const trimmed = String(token || '').trim();
  if (!trimmed) {
    throw new Error('Access token is required');
  }

  const tokenHash = hashToken(trimmed);
  const tokenRef = db.collection(TOKENS_COLLECTION).doc(tokenHash);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) {
    throw new Error('Invalid or expired access link');
  }

  const tokenData = tokenSnap.data() || {};
  const requestId = String(tokenData.requestId || '');
  const expiresAt = String(tokenData.expiresAt || '');
  const redeemedAt = tokenData.redeemedAt;

  if (!requestId) throw new Error('Invalid access token payload');
  if (redeemedAt) throw new Error('This access link has already been used');
  if (expiresAt && Date.parse(expiresAt) < Date.now()) {
    throw new Error('This access link has expired');
  }

  const secretsRef = db.collection(SECRETS_COLLECTION).doc(requestId);
  const secretsSnap = await secretsRef.get();
  if (!secretsSnap.exists) {
    throw new Error('Credentials are no longer available');
  }

  const secrets = secretsSnap.data() as WordPressProvisioningSecrets;
  const redeemedNow = new Date().toISOString();

  await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
    tx.update(tokenRef, { redeemedAt: redeemedNow });
    tx.delete(secretsRef);
  });

  return secrets;
}
