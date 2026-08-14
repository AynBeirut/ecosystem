import { Request, Response } from 'express';
import { redeemWordPressAccessToken } from '../services/wordpressProvisioningService';

export async function redeemWordPressAccess(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.body?.token || req.query?.token || '').trim();
    const credentials = await redeemWordPressAccessToken(token);

    res.json({
      success: true,
      businessName: credentials.hostingDomain,
      hosting: {
        domain: credentials.hostingDomain,
        panelUrl: credentials.panelUrl,
        username: credentials.webuzoUsername,
        password: credentials.webuzoPassword,
      },
      ftp: {
        host: credentials.ftpHost,
        username: credentials.ftpUsername,
        password: credentials.ftpPassword,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to redeem access link';
    res.status(400).json({ success: false, error: message });
  }
}
