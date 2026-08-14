import axios, { AxiosInstance } from 'axios';
import https from 'https';

export type WebuzoConfig = {
  host: string;
  adminUser: string;
  adminPass: string;
  adminPort: number;
  userApiPort: number;
  defaultPlan: string;
  ftpQuotaMb: number;
};

export type WebuzoCreateUserInput = {
  username: string;
  domain: string;
  email: string;
  password: string;
  plan?: string;
};

export type WebuzoCreateUserResult = {
  username: string;
  domain: string;
  password: string;
};

export type WebuzoCreateFtpInput = {
  accountUser: string;
  accountPass: string;
  login: string;
  password: string;
  domain: string;
  directory?: string;
};

export type WebuzoCreateFtpResult = {
  login: string;
  domain: string;
  directory: string;
};

type WebuzoApiResponse = {
  done?: Record<string, unknown> | string;
  error?: unknown;
};

function readWebuzoConfig(): WebuzoConfig | null {
  const host = String(process.env.WEBUZO_HOST || '').trim();
  const adminUser = String(process.env.WEBUZO_ADMIN_USER || '').trim();
  const adminPass = String(process.env.WEBUZO_ADMIN_PASS || '').trim();
  if (!host || !adminUser || !adminPass) return null;

  return {
    host,
    adminUser,
    adminPass,
    adminPort: parseInt(process.env.WEBUZO_ADMIN_PORT || '2005', 10),
    userApiPort: parseInt(process.env.WEBUZO_USER_API_PORT || '2003', 10),
    defaultPlan: String(process.env.WEBUZO_DEFAULT_PLAN ?? '').trim(),
    ftpQuotaMb: parseInt(process.env.WEBUZO_FTP_QUOTA_MB || '5120', 10),
  };
}

function createClient(host: string, port: number, user: string, pass: string): AxiosInstance {
  return axios.create({
    baseURL: `https://${host}:${port}`,
    auth: { username: user, password: pass },
    timeout: 30000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });
}

function parseWebuzoResponse(data: unknown): WebuzoApiResponse {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as WebuzoApiResponse;
    } catch {
      return { error: data };
    }
  }
  return (data || {}) as WebuzoApiResponse;
}

function formatWebuzoError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) return error.map((item) => String(item)).join('; ');
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.msg === 'string') return record.msg;
    return JSON.stringify(record);
  }
  return 'Unknown Webuzo error';
}

function assertWebuzoSuccess(response: WebuzoApiResponse, action: string): void {
  if (response.error) {
    throw new Error(`${action} failed: ${formatWebuzoError(response.error)}`);
  }
  if (!response.done) {
    throw new Error(`${action} failed: empty response from Webuzo`);
  }
}

export function isWebuzoConfigured(): boolean {
  return readWebuzoConfig() !== null;
}

export async function createWebuzoUser(input: WebuzoCreateUserInput): Promise<WebuzoCreateUserResult> {
  const config = readWebuzoConfig();
  if (!config) {
    throw new Error('Webuzo is not configured (WEBUZO_HOST/WEBUZO_ADMIN_USER/WEBUZO_ADMIN_PASS)');
  }

  const client = createClient(config.host, config.adminPort, config.adminUser, config.adminPass);
  const body = new URLSearchParams({
    create_user: '1',
    user: input.username,
    user_passwd: input.password,
    cnf_user_passwd: input.password,
    domain: input.domain,
    email: input.email,
    plan: input.plan || config.defaultPlan,
    billing_prefill: '1',
  });

  const response = await client.post('/index.php?api=json&act=add_user', body.toString());
  const payload = parseWebuzoResponse(response.data);
  assertWebuzoSuccess(payload, 'create_user');

  return {
    username: input.username,
    domain: input.domain,
    password: input.password,
  };
}

export async function createWebuzoFtpAccount(input: WebuzoCreateFtpInput): Promise<WebuzoCreateFtpResult> {
  const config = readWebuzoConfig();
  if (!config) {
    throw new Error('Webuzo is not configured (WEBUZO_HOST/WEBUZO_ADMIN_USER/WEBUZO_ADMIN_PASS)');
  }

  const directory = input.directory || '/public_html';
  const client = createClient(config.host, config.userApiPort, input.accountUser, input.accountPass);
  const body = new URLSearchParams({
    create_acc: '1',
    login: input.login,
    newpass: input.password,
    conf: input.password,
    ftpdomain: input.domain,
    dir: directory,
    quota: 'limited',
    quota_limit: String(Math.max(config.ftpQuotaMb, 100)),
  });

  const response = await client.post('/index.php?api=json&act=ftp_account', body.toString());
  const payload = parseWebuzoResponse(response.data);
  assertWebuzoSuccess(payload, 'create_ftp_account');

  return {
    login: input.login,
    domain: input.domain,
    directory,
  };
}

export function getWebuzoPublicEndpoints(domain: string): {
  panelUrl: string;
  ftpHost: string;
} {
  const config = readWebuzoConfig();
  const host = config?.host || domain;
  return {
    panelUrl: `https://${domain}:2003`,
    ftpHost: host,
  };
}
