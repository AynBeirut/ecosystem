import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { assertStoreAccess, verifyUser } from '../lib/travelAgencyAuth';
import { signProposalToken, verifyProposalToken } from '../lib/travelProposalToken';
import {
  nextraBook,
  nextraBookingList,
  nextraSearch,
  nextraWallet,
} from '../integrations/nextra/client';
import type { NextraProductType, NextraSearchParams, NextraTenantConfig } from '../integrations/nextra/types';

const db = admin.firestore();

async function loadNextraConfig(storeId: string): Promise<NextraTenantConfig> {
  const snap = await db.doc(`stores/${storeId}/travelSettings/nextra`).get();
  const data = snap.data() || {};
  const apiBaseUrl = String(data.apiBaseUrl || process.env.NEXTRA_API_BASE_URL || 'https://api.nextra.travel');
  return {
    apiBaseUrl,
    apiKey: data.apiKey ? String(data.apiKey) : process.env.NEXTRA_API_KEY,
    agentUserId: data.agentUserId ? String(data.agentUserId) : undefined,
  };
}

function storeIdFromBody(req: Request): string {
  const storeId = String(req.body?.storeId || req.query?.storeId || '').trim();
  if (!storeId) throw new Error('storeId required');
  return storeId;
}

export async function travelNextraSearch(req: Request, res: Response): Promise<void> {
  try {
    const user = await verifyUser(req);
    const storeId = storeIdFromBody(req);
    await assertStoreAccess(user.uid, storeId);
    const params = req.body as NextraSearchParams;
    const config = await loadNextraConfig(storeId);
    const offers = await nextraSearch(config, params);
    res.json({ ok: true, offers });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'search failed' });
  }
}

export async function travelNextraBook(req: Request, res: Response): Promise<void> {
  try {
    const user = await verifyUser(req);
    const storeId = storeIdFromBody(req);
    await assertStoreAccess(user.uid, storeId);
    const { dealId, offerId, productType, passengers } = req.body as {
      dealId?: string;
      offerId: string;
      productType: NextraProductType;
      passengers?: Array<{ firstName: string; lastName: string; type: 'adult' | 'child' | 'infant' }>;
    };
    const config = await loadNextraConfig(storeId);
    const result = await nextraBook(config, { offerId, productType, dealId, passengers });
    if (dealId) {
      await db.doc(`stores/${storeId}/travelDeals/${dealId}`).set(
        {
          bookingRef: result.bookingRef,
          pnr: result.pnr || null,
          stage: 'booked',
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    res.json({ ok: true, result });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'book failed' });
  }
}

export async function travelNextraWallet(req: Request, res: Response): Promise<void> {
  try {
    const user = await verifyUser(req);
    const storeId = storeIdFromBody(req);
    await assertStoreAccess(user.uid, storeId);
    const config = await loadNextraConfig(storeId);
    const wallet = await nextraWallet(config);
    res.json({ ok: true, wallet });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'wallet failed' });
  }
}

export async function travelNextraBookings(req: Request, res: Response): Promise<void> {
  try {
    const user = await verifyUser(req);
    const storeId = storeIdFromBody(req);
    await assertStoreAccess(user.uid, storeId);
    const config = await loadNextraConfig(storeId);
    const bookings = await nextraBookingList(config);
    res.json({ ok: true, bookings });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'bookings failed' });
  }
}

export async function travelCreateProposalLink(req: Request, res: Response): Promise<void> {
  try {
    const user = await verifyUser(req);
    const storeId = String(req.body?.storeId || '').trim();
    const quoteId = String(req.body?.quoteId || '').trim();
    if (!storeId || !quoteId) {
      res.status(400).json({ error: 'storeId and quoteId required' });
      return;
    }
    await assertStoreAccess(user.uid, storeId);
    const expiresAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const token = signProposalToken(storeId, quoteId, expiresAtMs);
    const publicPath = `/travel/p/${token}`;
    await db.doc(`stores/${storeId}/travelQuotes/${quoteId}`).set(
      { publicToken: token, publicExpiresAt: new Date(expiresAtMs).toISOString() },
      { merge: true },
    );
    res.json({ ok: true, token, publicPath });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'link failed' });
  }
}

export async function travelGetPublicProposal(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.params.token || '').trim();
    const parsed = verifyProposalToken(token);
    if (!parsed) {
      res.status(404).json({ error: 'Invalid or expired link' });
      return;
    }
    const quoteSnap = await db.doc(`stores/${parsed.storeId}/travelQuotes/${parsed.quoteId}`).get();
    if (!quoteSnap.exists) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    const quote = quoteSnap.data() || {};
    const brandingSnap = await db.doc(`stores/${parsed.storeId}/travelSettings/branding`).get();
    res.json({
      ok: true,
      quote: {
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        currency: quote.currency,
        total: quote.total,
        margin: quote.margin,
        itinerary: quote.itinerary,
        days: quote.days,
        inclusions: quote.inclusions,
        exclusions: quote.exclusions,
        status: quote.status,
        customerName: quote.customerName,
      },
      branding: brandingSnap.data() || {},
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'load failed' });
  }
}

export async function travelAcceptProposal(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.body?.token || '').trim();
    const parsed = verifyProposalToken(token);
    if (!parsed) {
      res.status(404).json({ error: 'Invalid or expired link' });
      return;
    }
    const quoteRef = db.doc(`stores/${parsed.storeId}/travelQuotes/${parsed.quoteId}`);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    const now = new Date().toISOString();
    await quoteRef.set({ status: 'accepted', acceptedAt: now }, { merge: true });
    const dealId = String(quoteSnap.data()?.dealId || '');
    if (dealId) {
      await db.doc(`stores/${parsed.storeId}/travelDeals/${dealId}`).set(
        { stage: 'deposit_received', updatedAt: now },
        { merge: true },
      );
    }
    res.json({ ok: true, quoteNumber: quoteSnap.data()?.quoteNumber, message: 'Accepted — agency will confirm deposit.' });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'accept failed' });
  }
}

export async function travelRecordDeposit(req: Request, res: Response): Promise<void> {
  try {
    const user = await verifyUser(req);
    const storeId = String(req.body?.storeId || '').trim();
    const quoteId = String(req.body?.quoteId || '').trim();
    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || 'cash').trim();
    if (!storeId || !quoteId || !Number.isFinite(amount)) {
      res.status(400).json({ error: 'storeId, quoteId, amount required' });
      return;
    }
    await assertStoreAccess(user.uid, storeId);
    const receiptNumber = `RC-${new Date().toISOString().slice(0, 10)}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const now = new Date().toISOString();
    await db.collection(`stores/${storeId}/travelDeposits`).add({
      quoteId,
      amount,
      method,
      receiptNumber,
      recordedBy: user.uid,
      createdAt: now,
    });
    const quoteSnap = await db.doc(`stores/${storeId}/travelQuotes/${quoteId}`).get();
    const dealId = String(quoteSnap.data()?.dealId || '');
    if (dealId) {
      await db.doc(`stores/${storeId}/travelDeals/${dealId}`).set(
        { stage: 'deposit_received', updatedAt: now },
        { merge: true },
      );
    }
    res.json({ ok: true, receiptNumber });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'deposit failed' });
  }
}

export async function travelOwnerSummary(req: Request, res: Response): Promise<void> {
  try {
    const user = await verifyUser(req);
    const storeId = String(req.query?.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'storeId required' });
      return;
    }
    await assertStoreAccess(user.uid, storeId);
    const dealsSnap = await db.collection(`stores/${storeId}/travelDeals`).limit(500).get();
    let totalMargin = 0;
    let openDeals = 0;
    let bookedDeals = 0;
    const byStage: Record<string, number> = {};
    dealsSnap.forEach((docSnap: QueryDocumentSnapshot) => {
      const data = docSnap.data();
      const stage = String(data.stage || 'inquiry');
      byStage[stage] = (byStage[stage] || 0) + 1;
      if (stage !== 'closed' && stage !== 'lost') openDeals += 1;
      if (stage === 'booked' || stage === 'traveled') bookedDeals += 1;
      totalMargin += Number(data.marginTotal || 0);
    });
    const config = await loadNextraConfig(storeId);
    const wallet = await nextraWallet(config);
    const creditAlert = wallet.due > 0 && wallet.available < wallet.due * 0.5;
    res.json({
      ok: true,
      summary: {
        openDeals,
        bookedDeals,
        totalMargin,
        byStage,
        wallet,
        creditAlert,
      },
    });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'summary failed' });
  }
}
