import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { getFirestore, Transaction } from 'firebase-admin/firestore';
import { assertRealStoreForCommerce } from '../services/storeCommerceGuard';

type DefaultAiModel = {
  id: string;
  label: string;
  provider: string;
  creditsPerUnit: number;
  unitLabel: string;
  defaultCostPerCreditUsd: number;
  description: string;
};

type AiModelPricingSetting = {
  modelId: string;
  label: string;
  provider: string;
  creditsPerUnit: number;
  unitLabel: string;
  costPerCreditUsd: number;
  active: boolean;
};

type AiIntegrationSettings = {
  enabled: boolean;
  assistantAccessMode: 'owner-account';
  apiBaseUrl: string;
  apiKey: string;
  defaultModelId: string;
  modelPricing: AiModelPricingSetting[];
};

const DEFAULT_AI_MODELS: DefaultAiModel[] = [
  {
    id: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    provider: 'OpenAI',
    creditsPerUnit: 3,
    unitLabel: '1 request',
    defaultCostPerCreditUsd: 0.02,
    description: 'Fast and cost-efficient general assistant model.',
  },
  {
    id: 'gpt-5',
    label: 'GPT-5',
    provider: 'OpenAI',
    creditsPerUnit: 8,
    unitLabel: '1 request',
    defaultCostPerCreditUsd: 0.04,
    description: 'Higher quality reasoning for complex operations.',
  },
  {
    id: 'claude-3-7-sonnet',
    label: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    creditsPerUnit: 7,
    unitLabel: '1 request',
    defaultCostPerCreditUsd: 0.035,
    description: 'Balanced model for analysis and long-form writing.',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google',
    creditsPerUnit: 9,
    unitLabel: '1 request',
    defaultCostPerCreditUsd: 0.045,
    description: 'Strong multimodal model for advanced tasks.',
  },
  {
    id: 'gpt-image-1',
    label: 'GPT Image 1',
    provider: 'OpenAI',
    creditsPerUnit: 12,
    unitLabel: '1 image generation',
    defaultCostPerCreditUsd: 0.05,
    description: 'Product image generation and editing workflow model.',
  },
];

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function resolveStoreAuth(req: Request): Promise<{ storeId: string; uid: string }> {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');

  const decoded = await admin.auth().verifyIdToken(token);
  const requestedStoreId = String(req.body?.storeId || '').trim() || decoded.uid;

  if (decoded.uid !== requestedStoreId) {
    throw new Error('Unauthorized store access');
  }

  return { storeId: requestedStoreId, uid: decoded.uid };
}

function sanitizeModelPricing(raw: unknown): AiModelPricingSetting[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const modelId = String(item.modelId || '').trim();
      const label = String(item.label || '').trim();
      const provider = String(item.provider || '').trim();
      const unitLabel = String(item.unitLabel || '').trim() || '1 request';
      const creditsPerUnit = Number(item.creditsPerUnit || 0);
      const costPerCreditUsd = Number(item.costPerCreditUsd || 0);
      const active = Boolean(item.active);

      if (!modelId || !label || !provider) return null;
      if (!Number.isFinite(creditsPerUnit) || creditsPerUnit <= 0) return null;
      if (!Number.isFinite(costPerCreditUsd) || costPerCreditUsd < 0) return null;

      return {
        modelId,
        label,
        provider,
        unitLabel,
        creditsPerUnit,
        costPerCreditUsd,
        active,
      };
    })
    .filter((entry): entry is AiModelPricingSetting => Boolean(entry));
}

function sanitizeAiSettings(raw: unknown): AiIntegrationSettings {
  const input = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const modelPricing = sanitizeModelPricing(input.modelPricing);

  const defaultModelId = String(input.defaultModelId || '').trim();
  const defaultIsAvailable = modelPricing.some((m) => m.modelId === defaultModelId && m.active);

  return {
    enabled: Boolean(input.enabled),
    assistantAccessMode: 'owner-account',
    apiBaseUrl: String(input.apiBaseUrl || '').trim(),
    apiKey: String(input.apiKey || '').trim(),
    defaultModelId: defaultIsAvailable ? defaultModelId : (modelPricing.find((m) => m.active)?.modelId || ''),
    modelPricing,
  };
}

export async function getAiModels(req: Request, res: Response): Promise<void> {
  try {
    const storeId = String(req.body?.storeId || req.query?.storeId || '').trim();
    const db = admin.firestore();

    let existingPricing: AiModelPricingSetting[] = [];
    if (storeId) {
      const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
      if (profileSnap.exists) {
        const raw = profileSnap.data()?.aiIntegrationSettings as Record<string, unknown> | undefined;
        existingPricing = sanitizeModelPricing(raw?.modelPricing);
      }
    }

    const modelOverrides = new Map(existingPricing.map((item) => [item.modelId, item]));

    const models = DEFAULT_AI_MODELS.map((model) => {
      const override = modelOverrides.get(model.id);
      return {
        id: model.id,
        label: model.label,
        provider: model.provider,
        creditsPerUnit: model.creditsPerUnit,
        unitLabel: model.unitLabel,
        description: model.description,
        costPerCreditUsd: override?.costPerCreditUsd ?? model.defaultCostPerCreditUsd,
        active: override?.active ?? true,
      };
    });

    res.json({
      success: true,
      assistantAccessMode: 'owner-account',
      currency: 'USD',
      models,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load AI models';
    res.status(500).json({ success: false, message });
  }
}

export async function saveAiSettings(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, uid } = await resolveStoreAuth(req);
    const settings = sanitizeAiSettings(req.body?.aiIntegrationSettings);

    const db = admin.firestore();
    await assertRealStoreForCommerce(db, storeId);

    await db.collection('storeProfiles').doc(storeId).set(
      {
        aiIntegrationSettings: settings,
        aiIntegrationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        aiIntegrationUpdatedBy: uid,
      },
      { merge: true },
    );

    res.json({
      success: true,
      message: 'AI integration settings saved successfully.',
      aiIntegrationSettings: settings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save AI settings';
    const status = message.includes('Unauthorized') ? 403 : message.includes('Missing bearer token') ? 401 : 500;
    res.status(status).json({ success: false, message });
  }
}

export async function getAiCreditBalance(req: Request, res: Response): Promise<void> {
  try {
    const { storeId } = await resolveStoreAuth(req);
    const snap = await admin.firestore().collection('storeProfiles').doc(storeId).get();
    const balance = Number(snap.data()?.aiCreditBalance) || 0;
    res.json({ success: true, balance });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load balance';
    res.status(500).json({ success: false, message });
  }
}

export async function generateAiContent(req: Request, res: Response): Promise<void> {
  try {
    const { storeId } = await resolveStoreAuth(req);
    const prompt = String(req.body?.prompt || '').trim();
    const tool = String(req.body?.tool || 'content_generation').trim();
    const modelIdOverride = String(req.body?.modelId || '').trim();

    if (!prompt) {
      res.status(400).json({ success: false, message: 'Prompt is required' });
      return;
    }

    const db = getFirestore();
    await assertRealStoreForCommerce(db, storeId);

    const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
    const profileData = profileSnap.data() || {};

    const settings = sanitizeAiSettings(profileData.aiIntegrationSettings);
    if (!settings.enabled || !settings.apiKey) {
      res.status(400).json({
        success: false,
        message: 'AI integration not configured. Add your API key in AI Builder settings.',
      });
      return;
    }

    const currentBalance = Number(profileData.aiCreditBalance) || 0;
    const modelId = modelIdOverride || settings.defaultModelId || 'gpt-4o-mini';
    const modelPricing = settings.modelPricing.find((m) => m.modelId === modelId && m.active);
    const creditCost = modelPricing?.creditsPerUnit ?? 3;

    if (currentBalance < creditCost) {
      res.status(402).json({
        success: false,
        message: 'Insufficient AI credits. Purchase more credits to continue.',
      });
      return;
    }

    const apiBaseUrl = (settings.apiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const aiRes = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.json().catch(() => ({})) as Record<string, unknown>;
      const errMsg = (errBody?.error as Record<string, unknown> | undefined)?.message;
      throw new Error(String(errMsg || `AI API returned ${aiRes.status}`));
    }

    const aiData = await aiRes.json() as { choices: Array<{ message: { content: string } }> };
    const content = aiData.choices?.[0]?.message?.content?.trim() || '';

    const balanceAfter = currentBalance - creditCost;
    await db.runTransaction(async (tx: Transaction) => {
      tx.update(db.collection('storeProfiles').doc(storeId), { aiCreditBalance: balanceAfter });
      const ledgerRef = db.collection('stores').doc(storeId).collection('aiCreditLedger').doc();
      tx.set(ledgerRef, {
        type: 'deduction',
        credits: -creditCost,
        balanceAfter,
        reason: `AI tool: ${tool}`,
        modelId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true, content, creditsUsed: creditCost, balanceAfter });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    res.status(500).json({ success: false, message });
  }
}

export async function deductAiCredits(req: Request, res: Response): Promise<void> {
  try {
    const { storeId } = await resolveStoreAuth(req);
    const cost = Math.max(1, Number(req.body?.credits) || 0);
    const reason = String(req.body?.reason || 'AI usage');
    const modelId = String(req.body?.modelId || '').trim() || undefined;

    const db = getFirestore();
    await assertRealStoreForCommerce(db, storeId);
    const ref = db.collection('storeProfiles').doc(storeId);

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      const current = Number(snap.data()?.aiCreditBalance) || 0;
      if (current < cost) throw new Error('Insufficient AI credits');
      const balanceAfter = current - cost;
      tx.update(ref, { aiCreditBalance: balanceAfter });
      const ledgerRef = db.collection('stores').doc(storeId).collection('aiCreditLedger').doc();
      tx.set(ledgerRef, {
        type: 'deduction',
        credits: -cost,
        balanceAfter,
        reason,
        modelId: modelId ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Deduction failed';
    const status = message.includes('Insufficient') ? 402 : 500;
    res.status(status).json({ success: false, message });
  }
}
