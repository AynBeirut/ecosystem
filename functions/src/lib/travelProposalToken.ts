import * as crypto from 'crypto';

const SECRET = process.env.TRAVEL_PROPOSAL_SECRET || 'dev-travel-proposal-secret-change-me';

export function signProposalToken(storeId: string, quoteId: string, expiresAtMs: number): string {
  const payload = `${storeId}:${quoteId}:${expiresAtMs}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyProposalToken(token: string): { storeId: string; quoteId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length < 4) return null;
    const expiresAtMs = Number(parts[2]);
    if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return null;
    const storeId = parts[0];
    const quoteId = parts[1];
    const payload = `${storeId}:${quoteId}:${expiresAtMs}`;
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    const sig = parts.slice(3).join(':');
    if (sig !== expected) return null;
    return { storeId, quoteId };
  } catch {
    return null;
  }
}
