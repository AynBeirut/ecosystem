import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { getFirestore, Transaction } from 'firebase-admin/firestore';
import { canUseModule } from '../lib/entitlements';
import { assertRealStoreForCommerce } from '../services/storeCommerceGuard';

type AgentSkill = 'general' | 'marketing' | 'finance-consulting';
type SkillMode = 'auto' | 'manual';
type ModelMode = 'auto' | 'manual';
type ProviderId = 'openai' | 'anthropic' | 'gemini';

type ProviderModelConfig = {
  provider: ProviderId;
  modelId: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  maxOutputTokens: number;
  specialties: AgentSkill[];
};

const PROVIDER_MODELS: ProviderModelConfig[] = [
  {
    provider: 'openai',
    modelId: 'gpt-5-mini',
    inputPerMillionUsd: 0.25,
    outputPerMillionUsd: 2.0,
    maxOutputTokens: 900,
    specialties: ['general', 'marketing'],
  },
  {
    provider: 'openai',
    modelId: 'gpt-5',
    inputPerMillionUsd: 1.25,
    outputPerMillionUsd: 10.0,
    maxOutputTokens: 1200,
    specialties: ['finance-consulting', 'general'],
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    inputPerMillionUsd: 3.0,
    outputPerMillionUsd: 15.0,
    maxOutputTokens: 1000,
    specialties: ['finance-consulting', 'general'],
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    inputPerMillionUsd: 0.3,
    outputPerMillionUsd: 2.5,
    maxOutputTokens: 900,
    specialties: ['general', 'marketing'],
  },
];

const MODULE_PAGE_SKILL_MAP: Array<{ hint: string; skill: AgentSkill }> = [
  { hint: 'finance', skill: 'finance-consulting' },
  { hint: 'account-statement', skill: 'finance-consulting' },
  { hint: 'expenses', skill: 'finance-consulting' },
  { hint: 'revenue', skill: 'finance-consulting' },
  { hint: 'marketing', skill: 'marketing' },
  { hint: 'campaign', skill: 'marketing' },
  { hint: 'seo', skill: 'marketing' },
  { hint: 'crm', skill: 'marketing' },
];

const SKILL_PROMPTS: Record<AgentSkill, string> = {
  general:
    'You are Grabio General Assistant. Be concise, practical, and do not invent facts. If data is missing, say what is missing.',
  marketing:
    'You are Grabio Marketing Specialist. Focus on campaign copy, positioning, audience segmentation, and actionable next steps for SMB stores.',
  'finance-consulting':
    'You are Grabio Finance Consulting Specialist. Focus on cash flow, receivables, expenses, and margin improvement using only provided tenant-scoped finance context.',
};

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function resolveStoreAuth(req: Request): Promise<{ storeId: string; uid: string }> {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');

  const decoded = await admin.auth().verifyIdToken(token);
  const requestedStoreId = String(req.body?.storeId || '').trim() || decoded.uid;
  if (!requestedStoreId) throw new Error('Missing storeId');

  if (decoded.uid !== requestedStoreId) {
    throw new Error('Unauthorized store access');
  }

  return { storeId: requestedStoreId, uid: decoded.uid };
}

function normalizeSkill(raw: unknown): AgentSkill | null {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'general' || value === 'marketing' || value === 'finance-consulting') {
    return value;
  }
  return null;
}

function normalizeProvider(raw: unknown): ProviderId | null {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'openai' || value === 'anthropic' || value === 'gemini') return value;
  return null;
}

function inferSkillFromIntent(prompt: string): { skill: AgentSkill; confidence: number; source: 'intent' | 'fallback' } {
  const text = prompt.toLowerCase();
  const financeHits = ['cash flow', 'profit', 'margin', 'receivable', 'expense', 'balance', 'ledger'].filter((k) =>
    text.includes(k),
  ).length;
  const marketingHits = ['campaign', 'ad copy', 'seo', 'email', 'audience', 'positioning', 'marketing'].filter((k) =>
    text.includes(k),
  ).length;

  if (financeHits >= 2 && financeHits > marketingHits) {
    return { skill: 'finance-consulting', confidence: 0.82, source: 'intent' };
  }
  if (marketingHits >= 2 && marketingHits > financeHits) {
    return { skill: 'marketing', confidence: 0.82, source: 'intent' };
  }
  return { skill: 'general', confidence: 0.45, source: 'fallback' };
}

function routeSkill(input: {
  prompt: string;
  pageContext: string;
  skillMode: SkillMode;
  manualSkill: AgentSkill | null;
}): { skill: AgentSkill; confidence: number; source: 'manual' | 'context' | 'intent' | 'fallback' } {
  if (input.skillMode === 'manual' && input.manualSkill) {
    return { skill: input.manualSkill, confidence: 1, source: 'manual' };
  }

  const page = input.pageContext.toLowerCase();
  for (const rule of MODULE_PAGE_SKILL_MAP) {
    if (page.includes(rule.hint)) {
      return { skill: rule.skill, confidence: 0.9, source: 'context' };
    }
  }

  return inferSkillFromIntent(input.prompt);
}

function routeModel(input: {
  modelMode: ModelMode;
  manualProvider: ProviderId | null;
  manualModelId: string;
  skill: AgentSkill;
}): ProviderModelConfig {
  if (input.modelMode === 'manual' && input.manualProvider && input.manualModelId) {
    const manual = PROVIDER_MODELS.find(
      (m) => m.provider === input.manualProvider && m.modelId === input.manualModelId,
    );
    if (manual) return manual;
  }

  const candidates = PROVIDER_MODELS.filter((m) => m.specialties.includes(input.skill));
  if (!candidates.length) return PROVIDER_MODELS[0];

  return candidates.sort((a, b) => a.inputPerMillionUsd + a.outputPerMillionUsd - (b.inputPerMillionUsd + b.outputPerMillionUsd))[0];
}

async function getTenantFinanceContext(db: FirebaseFirestore.Firestore, storeId: string): Promise<Record<string, unknown>> {
  const [ordersSnap, expensesSnap] = await Promise.all([
    db.collection('orders').where('storeId', '==', storeId).orderBy('createdAt', 'desc').limit(25).get(),
    db.collection('expenses').where('storeId', '==', storeId).orderBy('createdAt', 'desc').limit(25).get(),
  ]);

  let grossRevenue = 0;
  let paidRevenue = 0;
  let receivable = 0;
  let totalExpenses = 0;

  ordersSnap.forEach((doc) => {
    const data = doc.data();
    const status = String(data.status || '').toLowerCase();
    if (status === 'cancelled') return;
    const total = Number(data.total || 0);
    const paid = Number(data.amountPaid || 0);
    if (Number.isFinite(total) && total > 0) {
      grossRevenue += total;
      paidRevenue += Math.max(0, Math.min(total, Number.isFinite(paid) ? paid : 0));
      receivable += Math.max(0, total - (Number.isFinite(paid) ? paid : 0));
    }
  });

  expensesSnap.forEach((doc) => {
    const amount = Number(doc.data().amount || 0);
    if (Number.isFinite(amount) && amount > 0) totalExpenses += amount;
  });

  return {
    summary: {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      paidRevenue: Number(paidRevenue.toFixed(2)),
      receivable: Number(receivable.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netPosition: Number((paidRevenue - totalExpenses).toFixed(2)),
    },
    sampleOrderCount: ordersSnap.size,
    sampleExpenseCount: expensesSnap.size,
  };
}

async function getTenantMarketingContext(db: FirebaseFirestore.Firestore, storeId: string): Promise<Record<string, unknown>> {
  const [ordersSnap, productsSnap] = await Promise.all([
    db.collection('orders').where('storeId', '==', storeId).orderBy('createdAt', 'desc').limit(25).get(),
    db.collection('products').where('storeId', '==', storeId).limit(50).get(),
  ]);

  const topProducts = new Map<string, number>();
  let totalOrders = 0;
  ordersSnap.forEach((doc) => {
    const data = doc.data();
    const status = String(data.status || '').toLowerCase();
    if (status === 'cancelled') return;
    totalOrders += 1;
    const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
    items.forEach((item) => {
      const name = String(item.name || item.productId || 'unknown');
      const qty = Number(item.quantity || 0);
      if (qty > 0) {
        topProducts.set(name, (topProducts.get(name) || 0) + qty);
      }
    });
  });

  const topSellingProducts = [...topProducts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  return {
    summary: {
      totalOrders,
      activeCatalogItems: productsSnap.size,
      topSellingProducts,
    },
  };
}

async function buildContextForSkill(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  skill: AgentSkill,
): Promise<Record<string, unknown>> {
  if (skill === 'finance-consulting') {
    return getTenantFinanceContext(db, storeId);
  }
  if (skill === 'marketing') {
    return getTenantMarketingContext(db, storeId);
  }
  return {};
}

type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
};

async function callOpenAI(
  apiKey: string,
  model: ProviderModelConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; usage: ProviderUsage }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: model.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String((errBody.error as Record<string, unknown> | undefined)?.message || `OpenAI error ${response.status}`));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    content: data.choices?.[0]?.message?.content?.trim() || '',
    usage: {
      inputTokens: Number(data.usage?.prompt_tokens || 0),
      outputTokens: Number(data.usage?.completion_tokens || 0),
    },
  };
}

async function callAnthropic(
  apiKey: string,
  model: ProviderModelConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; usage: ProviderUsage }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model.modelId,
      max_tokens: model.maxOutputTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String((errBody.error as Record<string, unknown> | undefined)?.message || `Anthropic error ${response.status}`));
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = (data.content || []).filter((p) => p.type === 'text').map((p) => p.text || '').join('\n').trim();

  return {
    content: text,
    usage: {
      inputTokens: Number(data.usage?.input_tokens || 0),
      outputTokens: Number(data.usage?.output_tokens || 0),
    },
  };
}

async function callGemini(
  apiKey: string,
  model: ProviderModelConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; usage: ProviderUsage }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: model.maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String((errBody.error as Record<string, unknown> | undefined)?.message || `Gemini error ${response.status}`));
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n').trim() || '';

  return {
    content: text,
    usage: {
      inputTokens: Number(data.usageMetadata?.promptTokenCount || 0),
      outputTokens: Number(data.usageMetadata?.candidatesTokenCount || 0),
    },
  };
}

function getProviderApiKey(provider: ProviderId): string {
  if (provider === 'openai') return String(process.env.OPENAI_API_KEY || '').trim();
  if (provider === 'anthropic') return String(process.env.ANTHROPIC_API_KEY || '').trim();
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function roundUsd(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
}

export async function queryAgent(req: Request, res: Response): Promise<void> {
  try {
    const { storeId } = await resolveStoreAuth(req);
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) {
      res.status(400).json({ success: false, message: 'Prompt is required' });
      return;
    }

    const db = getFirestore();
    await assertRealStoreForCommerce(db, storeId);

    const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
    const profile = profileSnap.data() || {};

    if (!canUseModule(profile, 'ai_agent')) {
      res.status(403).json({ success: false, message: 'Module not enabled: ai_agent' });
      return;
    }

    const skillMode = String(req.body?.skillMode || 'auto').trim().toLowerCase() === 'manual' ? 'manual' : 'auto';
    const modelMode = String(req.body?.modelMode || 'auto').trim().toLowerCase() === 'manual' ? 'manual' : 'auto';
    const manualSkill = normalizeSkill(req.body?.skill);
    const manualProvider = normalizeProvider(req.body?.provider);
    const manualModelId = String(req.body?.modelId || '').trim();
    const pageContext = String(req.body?.context?.page || req.body?.context?.module || req.body?.context?.route || '').trim();

    const routedSkill = routeSkill({ prompt, pageContext, skillMode, manualSkill });
    const model = routeModel({ modelMode, manualProvider, manualModelId, skill: routedSkill.skill });

    const apiKey = getProviderApiKey(model.provider);
    if (!apiKey) {
      res.status(503).json({
        success: false,
        message: `Missing ${model.provider.toUpperCase()} API key on server`,
      });
      return;
    }

    const currentBalance = Number(profile.aiCreditBalance || 0);
    if (currentBalance <= 0) {
      res.status(402).json({
        success: false,
        message: 'AI balance is zero. Recharge required.',
      });
      return;
    }

    const tenantContext = await buildContextForSkill(db, storeId, routedSkill.skill);
    const systemPrompt = SKILL_PROMPTS[routedSkill.skill];
    const userPrompt = JSON.stringify({
      userPrompt: prompt,
      tenantContext,
    });

    const providerResult =
      model.provider === 'openai'
        ? await callOpenAI(apiKey, model, systemPrompt, userPrompt)
        : model.provider === 'anthropic'
          ? await callAnthropic(apiKey, model, systemPrompt, userPrompt)
          : await callGemini(apiKey, model, systemPrompt, userPrompt);

    const rawCostUsd = roundUsd(
      (providerResult.usage.inputTokens / 1_000_000) * model.inputPerMillionUsd +
        (providerResult.usage.outputTokens / 1_000_000) * model.outputPerMillionUsd,
    );
    const billedCostUsd = roundUsd(rawCostUsd * 1.15);

    if (billedCostUsd <= 0) {
      res.status(502).json({ success: false, message: 'Provider usage was missing token accounting' });
      return;
    }

    const storeRef = db.collection('storeProfiles').doc(storeId);
    let balanceAfter = currentBalance;
    await db.runTransaction(async (tx: Transaction) => {
      const freshSnap = await tx.get(storeRef);
      const freshBalance = Number(freshSnap.data()?.aiCreditBalance || 0);
      if (freshBalance < billedCostUsd) {
        throw new Error('Insufficient AI balance. Recharge required.');
      }

      balanceAfter = roundUsd(freshBalance - billedCostUsd);
      tx.update(storeRef, { aiCreditBalance: balanceAfter });

      const ledgerRef = db.collection('stores').doc(storeId).collection('aiCreditLedger').doc();
      tx.set(ledgerRef, {
        type: 'deduction',
        reason: 'ai_agent_query',
        specialist: routedSkill.skill,
        provider: model.provider,
        modelId: model.modelId,
        route: {
          skillMode,
          modelMode,
          skillSource: routedSkill.source,
          routingConfidence: routedSkill.confidence,
          pageContext: pageContext || null,
        },
        usage: {
          inputTokens: providerResult.usage.inputTokens,
          outputTokens: providerResult.usage.outputTokens,
        },
        pricing: {
          inputPerMillionUsd: model.inputPerMillionUsd,
          outputPerMillionUsd: model.outputPerMillionUsd,
          rawCostUsd,
          markupPercent: 15,
          billedCostUsd,
        },
        credits: -billedCostUsd,
        balanceAfter,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({
      success: true,
      content: providerResult.content,
      routing: {
        skill: routedSkill.skill,
        confidence: routedSkill.confidence,
        source: routedSkill.source,
      },
      model: {
        provider: model.provider,
        modelId: model.modelId,
      },
      usage: providerResult.usage,
      pricing: {
        rawCostUsd,
        billedCostUsd,
      },
      balanceAfter,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent query failed';
    const status =
      message.includes('Missing bearer token')
        ? 401
        : message.includes('Unauthorized')
          ? 403
          : message.includes('Insufficient AI balance')
            ? 402
            : 500;
    res.status(status).json({ success: false, message });
  }
}
