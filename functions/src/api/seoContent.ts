import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { runCursorTextPrompt } from '../lib/cursorCloudAgent';

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function assertPlatformAdmin(req: Request): Promise<string> {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');

  const decoded = await admin.auth().verifyIdToken(token);
  const userSnap = await admin.firestore().collection('users').doc(decoded.uid).get();
  const role = String(userSnap.data()?.role ?? '');
  if (role !== 'admin') throw new Error('Platform admin access required');

  return decoded.uid;
}

async function generateWithOpenAi(prompt: string): Promise<string> {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured on Cloud Functions.');
  }

  const modelId = String(process.env.SEO_CONTENT_MODEL || 'gpt-4o-mini').trim();
  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: 'You are Grabio SEO content engine. Return only valid JSON as requested — no code fences.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 3500,
      temperature: 0.6,
    }),
  });

  if (!aiRes.ok) {
    const errBody = (await aiRes.json().catch(() => ({}))) as Record<string, unknown>;
    const errMsg = (errBody?.error as Record<string, unknown> | undefined)?.message;
    throw new Error(String(errMsg || `OpenAI returned ${aiRes.status}`));
  }

  const aiData = (await aiRes.json()) as { choices: Array<{ message: { content: string } }> };
  return aiData.choices?.[0]?.message?.content?.trim() || '';
}

export async function generateSeoContentDraft(req: Request, res: Response): Promise<void> {
  try {
    await assertPlatformAdmin(req);

    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) {
      res.status(400).json({ success: false, message: 'Prompt is required' });
      return;
    }

    const cursorKey = String(process.env.CURSOR_API_KEY || '').trim();
    const provider = String(process.env.SEO_CONTENT_PROVIDER || (cursorKey ? 'cursor' : 'openai')).trim().toLowerCase();

    let content = '';
    let usedProvider = provider;

    if (provider === 'cursor') {
      if (!cursorKey) {
        res.status(503).json({
          success: false,
          message: 'CURSOR_API_KEY not configured on Cloud Functions.',
        });
        return;
      }
      content = await runCursorTextPrompt(cursorKey, prompt);
    } else {
      content = await generateWithOpenAi(prompt);
      usedProvider = 'openai';
    }

    if (!content) {
      throw new Error('Draft generation returned empty content');
    }

    res.json({ success: true, content, provider: usedProvider });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Draft generation failed';
    const status = message.includes('admin') ? 403 : message.includes('Missing bearer') ? 401 : 500;
    res.status(status).json({ success: false, message });
  }
}
