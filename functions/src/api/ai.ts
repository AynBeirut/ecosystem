import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

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
