import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import {
  GRABIO_GUIDE_SYSTEM_RULES,
  GRABIO_GUIDE_OFF_TOPIC_REPLY,
  buildGrabioGuideKnowledgeBlock,
  buildPaidToolRedirectReply,
  buildTenantGuideContext,
  classifyGrabioGuidePrompt,
  detectPaidToolRedirect,
  buildGuideFallbackReply,
  polishSallyOutput,
  tryLocalGuideReply,
} from '../lib/grabioGuideKnowledge';
import {
  buildSallyCursorHintBlock,
  shouldUseCursor,
  tryPlaybookWithTenant,
  type SallyHistoryItem,
} from '../lib/sallyGuidePlaybook';
import { GRABIO_GUIDE_CURSOR_MODEL, runCursorTextPrompt } from '../lib/cursorCloudAgent';
import {
  buildHumanHandoff,
  detectHumanTransferRequest,
  isUncertainGuideAnswer,
  resolveStoreLabel,
} from '../lib/sallyHumanHandoff';

type GuideHistoryItem = { role: 'user' | 'assistant'; content: string };

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function resolveStoreAuth(req: Request): Promise<{ storeId: string; uid: string; email: string | null }> {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');

  const decoded = await admin.auth().verifyIdToken(token);
  const email = String(decoded.email || '').trim() || null;
  const requestedStoreId = String(req.body?.storeId || '').trim() || decoded.uid;
  if (!requestedStoreId) throw new Error('Missing storeId');

  if (decoded.uid === requestedStoreId) {
    return { storeId: requestedStoreId, uid: decoded.uid, email };
  }

  const db = getFirestore();
  const sellerSnap = await db.collection('sellers').doc(decoded.uid).get();
  const sellerStoreId = String(sellerSnap.data()?.storeId || '').trim();
  if (sellerStoreId && sellerStoreId === requestedStoreId) {
    return { storeId: requestedStoreId, uid: decoded.uid, email };
  }

  const userSnap = await db.collection('users').doc(decoded.uid).get();
  const userStoreId = String(
    userSnap.data()?.activeStoreId || userSnap.data()?.storeId || '',
  ).trim();
  if (userStoreId && userStoreId === requestedStoreId) {
    return { storeId: requestedStoreId, uid: decoded.uid, email };
  }

  throw new Error('Unauthorized store access');
}

const MAX_HISTORY = 10;
const MAX_HISTORY_CHARS = 600;
const DAILY_GUIDE_LIMIT = 60;
const CURSOR_GUIDE_TIMEOUT_MS = 90_000;

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function normalizeHistory(raw: unknown): GuideHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_HISTORY)
    .map((item) => {
      const row = item as Record<string, unknown>;
      const role = String(row.role || '').toLowerCase();
      const content = truncate(String(row.content || ''), MAX_HISTORY_CHARS);
      if ((role !== 'user' && role !== 'assistant') || !content) return null;
      return { role, content } as GuideHistoryItem;
    })
    .filter(Boolean) as GuideHistoryItem[];
}

/** Compact Cursor prompt — smaller knowledge block (saves credits per call). */
function buildCursorGuidePrompt(input: {
  knowledge: string;
  tenantContext: unknown;
  pageContext: string;
  history: GuideHistoryItem[];
  userPrompt: string;
}): string {
  const chat =
    input.history.length > 0
      ? input.history.map((h) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')
      : '(new conversation)';

  return [
    GRABIO_GUIDE_SYSTEM_RULES,
    '',
    buildSallyCursorHintBlock(),
    '',
    '--- KNOWLEDGE ---',
    input.knowledge,
    '',
    '--- CONTEXT ---',
    `PAGE: ${input.pageContext || '/admin/dashboard'}`,
    `STORE: ${JSON.stringify(input.tenantContext)}`,
    '',
    '--- CHAT ---',
    chat,
    '',
    '--- USER NOW ---',
    input.userPrompt,
  ].join('\n');
}

function respondLocal(
  res: Response,
  content: string,
  reason: 'local' | 'playbook',
  tenantContext?: unknown,
): void {
  res.json({
    success: true,
    agent: 'grabio_guide',
    content: polishSallyOutput(content),
    model: { provider: 'local', modelId: reason === 'playbook' ? 'sally-playbook' : 'sally-local' },
    skipped: true,
    reason,
    ...(tenantContext ? { tenantContext } : {}),
  });
}

async function handoffStoreName(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  userEmail: string | null,
  tenantContext: Awaited<ReturnType<typeof buildTenantGuideContext>> | null,
  clientHint: string,
): Promise<string> {
  return resolveStoreLabel(db, storeId, {
    userEmail,
    hint: clientHint || undefined,
    profileData: (tenantContext?.profile as Record<string, unknown>) ?? undefined,
  });
}

function respondHandoff(
  res: Response,
  input: {
    storeLabel: string;
    storeId: string;
    userEmail?: string | null;
    prompt: string;
    pageContext: string;
    reason: 'requested' | 'off_topic' | 'no_answer' | 'limit';
    skipped?: boolean;
    status?: number;
  },
): void {
  const handoff = buildHumanHandoff({
    storeId: input.storeId,
    storeName: input.storeLabel,
    userEmail: input.userEmail,
    prompt: input.prompt,
    page: input.pageContext,
    reason: input.reason,
  });
  const payload = {
    success: true,
    agent: 'grabio_guide',
    content: polishSallyOutput(handoff.reply),
    humanHandoff: { whatsappUrl: handoff.whatsappUrl, reason: handoff.reason },
    skipped: input.skipped ?? true,
    reason: `human_${input.reason}`,
  };
  if (input.status && input.status !== 200) {
    res.status(input.status).json({ ...payload, success: false });
  } else {
    res.json(payload);
  }
}

/**
 * POST /agent/guide — Sally via Cursor composer-2.5-fast (Grabio Guide).
 * Consulting / paid AI tools use multi-model routes separately.
 */
export async function queryGrabioGuide(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, email: userEmail } = await resolveStoreAuth(req);
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) {
      res.status(400).json({ success: false, message: 'Prompt is required' });
      return;
    }

    const cursorKey = String(process.env.CURSOR_API_KEY || '').trim();
    const db = getFirestore();

    const pageContext = String(
      req.body?.context?.page || req.body?.context?.route || req.body?.context?.module || '',
    ).trim();
    const clientStoreName = String(req.body?.context?.storeName || '').trim();
    const history = normalizeHistory(req.body?.history);

    if (detectHumanTransferRequest(prompt)) {
      const tenantContext = await buildTenantGuideContext(db, storeId);
      const storeLabel = await handoffStoreName(db, storeId, userEmail, tenantContext, clientStoreName);
      respondHandoff(res, {
        storeId,
        storeLabel,
        userEmail,
        prompt,
        pageContext,
        reason: 'requested',
      });
      return;
    }

    const topic = classifyGrabioGuidePrompt(prompt, history.length > 0);
    if (topic === 'off_topic') {
      res.json({
        success: true,
        agent: 'grabio_guide',
        content: polishSallyOutput(GRABIO_GUIDE_OFF_TOPIC_REPLY),
        skipped: true,
        reason: 'off_topic',
      });
      return;
    }

    const paidTool = detectPaidToolRedirect(prompt);
    if (paidTool) {
      res.json({
        success: true,
        agent: 'grabio_guide',
        content: polishSallyOutput(buildPaidToolRedirectReply(paidTool)),
        skipped: true,
        reason: 'paid_tool',
        redirectTo: paidTool.route,
        toolLabel: paidTool.label,
      });
      return;
    }

    const historySlice = history as SallyHistoryItem[];
    let localReply = tryLocalGuideReply(prompt, history);

    const shortFollowUp = history.length > 0 && prompt.length <= 32;
    const needsTenant =
      Boolean(localReply) ||
      shortFollowUp ||
      /set up|setup|get started|package|profile|missing|my store|onboarding|ngo|restaurant|factory|freelancer|shop/.test(
        prompt.toLowerCase(),
      );

    let tenantContext: Awaited<ReturnType<typeof buildTenantGuideContext>> | null = null;
    if (needsTenant) {
      tenantContext = await buildTenantGuideContext(db, storeId);
      const personalized = tryPlaybookWithTenant(prompt, historySlice, tenantContext);
      if (personalized) localReply = personalized;
      if (!localReply && shortFollowUp) {
        localReply = tryLocalGuideReply(prompt, history);
      }
    }

    if (localReply && !shouldUseCursor(prompt, historySlice, localReply)) {
      respondLocal(res, localReply, tenantContext ? 'playbook' : 'local', tenantContext ?? undefined);
      return;
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    let todayCount = 0;
    try {
      const recentSnap = await db
        .collection('stores')
        .doc(storeId)
        .collection('agentSessions')
        .orderBy('createdAt', 'desc')
        .limit(80)
        .get();
      todayCount = recentSnap.docs.filter((doc) => {
        const ts = doc.data().createdAt?.toDate?.() as Date | undefined;
        return ts && ts >= dayStart && doc.data().agent === 'grabio_guide';
      }).length;
    } catch {
      todayCount = 0;
    }
    if (todayCount >= DAILY_GUIDE_LIMIT) {
      if (!tenantContext) {
        tenantContext = await buildTenantGuideContext(db, storeId);
      }
      respondHandoff(res, {
        storeId,
        storeLabel: await handoffStoreName(db, storeId, userEmail, tenantContext, clientStoreName),
        userEmail,
        prompt,
        pageContext,
        reason: 'limit',
        status: 429,
      });
      return;
    }

    if (!tenantContext) {
      tenantContext = await buildTenantGuideContext(db, storeId);
    }
    const storeLabel = await handoffStoreName(db, storeId, userEmail, tenantContext, clientStoreName);
    const knowledge = buildGrabioGuideKnowledgeBlock({ includePlaybook: false });

    const fullPrompt = buildCursorGuidePrompt({
      knowledge,
      tenantContext,
      pageContext,
      history,
      userPrompt: prompt,
    });

    if (!cursorKey) {
      console.error('Sally: CURSOR_API_KEY missing');
      const fallback =
        localReply ||
        tryLocalGuideReply(prompt, history) ||
        buildGuideFallbackReply(prompt, history);
      if (fallback) {
        respondLocal(res, fallback, localReply ? 'playbook' : 'local', tenantContext ?? undefined);
        return;
      }
      respondHandoff(res, {
        storeId,
        storeLabel,
        userEmail,
        prompt,
        pageContext,
        reason: 'no_answer',
      });
      return;
    }

    let content: string;
    let model: { provider: string; modelId: string };

    try {
      content = await runCursorTextPrompt(cursorKey, fullPrompt, {
        agentName: 'sally-grabio-guide',
        model: GRABIO_GUIDE_CURSOR_MODEL,
        timeoutMs: CURSOR_GUIDE_TIMEOUT_MS,
      });
      model = { provider: 'cursor', modelId: 'composer-2.5-fast' };
    } catch (cursorErr) {
      console.error('Sally Cursor fallback', cursorErr);
      const fallback =
        localReply ||
        tryLocalGuideReply(prompt, history) ||
        buildGuideFallbackReply(prompt, history);
      if (fallback && !isUncertainGuideAnswer(fallback, 'sally-fallback')) {
        content = fallback;
        model = { provider: 'local', modelId: 'sally-fallback' };
      } else {
        const h = buildHumanHandoff({
          storeId,
          storeName: storeLabel,
          userEmail,
          prompt,
          page: pageContext,
          reason: 'no_answer',
        });
        content = h.reply;
        model = { provider: 'local', modelId: 'human-handoff' };
        res.json({
          success: true,
          agent: 'grabio_guide',
          content: polishSallyOutput(content),
          model,
          humanHandoff: { whatsappUrl: h.whatsappUrl, reason: h.reason },
          tenantContext,
        });
        return;
      }
    }

    content = polishSallyOutput(content);

    let humanHandoff: { whatsappUrl: string; reason: string } | undefined;
    if (isUncertainGuideAnswer(content, model.modelId)) {
      const h = buildHumanHandoff({
        storeId,
        storeName: storeLabel,
        userEmail,
        prompt,
        page: pageContext,
        reason: 'no_answer',
      });
      humanHandoff = { whatsappUrl: h.whatsappUrl, reason: h.reason };
      content = `${content}\n\n${h.reply}`;
    }

    const sessionRef = db.collection('stores').doc(storeId).collection('agentSessions').doc();
    await sessionRef.set({
      agent: 'grabio_guide',
      provider: model.provider,
      model: model.modelId,
      prompt,
      pageContext: pageContext || null,
      responsePreview: content.slice(0, 500),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      agent: 'grabio_guide',
      content,
      model,
      tenantContext,
      ...(humanHandoff ? { humanHandoff } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Grabio Guide query failed';
    const status =
      message.includes('Missing bearer token')
        ? 401
        : message.includes('Unauthorized')
          ? 403
          : message.includes('timed out')
            ? 504
            : 500;
    res.status(status).json({ success: false, message });
  }
}
