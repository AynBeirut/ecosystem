import * as crypto from 'crypto';

/**
 * Minimal AWS SigV4 presigned-URL generator for Cloudflare R2 (S3-compatible).
 * Generates a presigned PUT URL with UNSIGNED-PAYLOAD so the client can upload
 * a file directly to R2 without proxying bytes through Cloud Functions.
 *
 * No external SDK — keeps the functions bundle and cold start small.
 */

export interface R2PresignConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
}

export interface PresignPutParams {
  key: string;
  expiresSeconds?: number;
}

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';

/** RFC3986 encode a single path/query component. */
function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Encode an object key: encode each segment, keep '/' separators. */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((segment) => rfc3986Encode(segment))
    .join('/');
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key: crypto.BinaryLike | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

/**
 * Build a presigned PUT URL for the given object key.
 * Only the `host` header is signed; the client may send Content-Type as an
 * unsigned header (allowed for presigned URLs).
 */
export function presignPutUrl(config: R2PresignConfig, params: PresignPutParams): string {
  const region = config.region || 'auto';
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const expires = Math.min(Math.max(params.expiresSeconds || 300, 1), 604800);

  const now = new Date();
  const { amzDate, dateStamp } = amzDates(now);
  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;

  const canonicalUri = `/${encodeKey(config.bucket)}/${encodeKey(params.key)}`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

/** Sanitize a user-supplied file name into a safe object-key segment. */
export function sanitizeFileName(name: string): string {
  const base = String(name || 'file').split(/[\\/]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}
