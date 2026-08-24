export type SallyChatTurn = { role: 'user' | 'assistant'; content: string };

export type SallyLlmResult = {
  content: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  modelId: string;
  inputTokens: number;
  outputTokens: number;
};

type SallyModel = {
  provider: 'gemini' | 'openai' | 'anthropic';
  modelId: string;
  maxOutputTokens: number;
};

const DEFAULT_SALLY_MODELS: SallyModel[] = [
  { provider: 'gemini', modelId: 'gemini-2.5-flash', maxOutputTokens: 1024 },
  { provider: 'openai', modelId: 'gpt-5-mini', maxOutputTokens: 900 },
  { provider: 'openai', modelId: 'gpt-5', maxOutputTokens: 800 },
];

function getApiKey(provider: SallyModel['provider']): string {
  if (provider === 'openai') return String(process.env.OPENAI_API_KEY || '').trim();
  if (provider === 'anthropic') return String(process.env.ANTHROPIC_API_KEY || '').trim();
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function resolveSallyModels(): SallyModel[] {
  const preferred = String(process.env.GRABIO_SALLY_PROVIDER || 'gemini').trim().toLowerCase();
  const modelOverride = String(process.env.GRABIO_SALLY_MODEL || '').trim();
  if (modelOverride && preferred !== 'auto') {
    const provider =
      preferred === 'openai' || preferred === 'anthropic' || preferred === 'gemini'
        ? preferred
        : 'gemini';
    return [{ provider, modelId: modelOverride, maxOutputTokens: 1024 }];
  }
  const ordered = [...DEFAULT_SALLY_MODELS];
  if (preferred === 'openai') {
    ordered.sort((a, b) => (a.provider === 'openai' ? -1 : 1));
  } else if (preferred === 'anthropic') {
    return [{ provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', maxOutputTokens: 900 }];
  } else if (preferred === 'gemini') {
    ordered.sort((a, b) => (a.provider === 'gemini' ? -1 : 1));
  }
  return ordered;
}

async function callOpenAiChat(
  apiKey: string,
  model: SallyModel,
  systemPrompt: string,
  history: SallyChatTurn[],
  userPrompt: string,
): Promise<SallyLlmResult> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: userPrompt },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelId,
      messages,
      max_tokens: model.maxOutputTokens,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      String((errBody.error as Record<string, unknown> | undefined)?.message || `OpenAI ${response.status}`),
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content?.trim() || '';
  if (!content) throw new Error('OpenAI returned empty content');

  return {
    content,
    provider: 'openai',
    modelId: model.modelId,
    inputTokens: Number(data.usage?.prompt_tokens || 0),
    outputTokens: Number(data.usage?.completion_tokens || 0),
  };
}

async function callGeminiChat(
  apiKey: string,
  model: SallyModel,
  systemPrompt: string,
  history: SallyChatTurn[],
  userPrompt: string,
): Promise<SallyLlmResult> {
  const contents = [
    ...history.map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    })),
    { role: 'user', parts: [{ text: userPrompt }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: model.maxOutputTokens,
        temperature: 0.4,
      },
    }),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      String((errBody.error as Record<string, unknown> | undefined)?.message || `Gemini ${response.status}`),
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n').trim() || '';
  if (!content) throw new Error('Gemini returned empty content');

  return {
    content,
    provider: 'gemini',
    modelId: model.modelId,
    inputTokens: Number(data.usageMetadata?.promptTokenCount || 0),
    outputTokens: Number(data.usageMetadata?.candidatesTokenCount || 0),
  };
}

async function callAnthropicChat(
  apiKey: string,
  model: SallyModel,
  systemPrompt: string,
  history: SallyChatTurn[],
  userPrompt: string,
): Promise<SallyLlmResult> {
  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: userPrompt },
  ];

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
      messages,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      String((errBody.error as Record<string, unknown> | undefined)?.message || `Anthropic ${response.status}`),
    );
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const content = (data.content || [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text || '')
    .join('\n')
    .trim();
  if (!content) throw new Error('Anthropic returned empty content');

  return {
    content,
    provider: 'anthropic',
    modelId: model.modelId,
    inputTokens: Number(data.usage?.input_tokens || 0),
    outputTokens: Number(data.usage?.output_tokens || 0),
  };
}

/** Run Sally with real LLM + multi-turn history (Grabio AI agent showcase — no user credits). */
export async function runSallyChat(input: {
  systemPrompt: string;
  history: SallyChatTurn[];
  userPrompt: string;
}): Promise<SallyLlmResult> {
  const models = resolveSallyModels();
  const errors: string[] = [];

  for (const model of models) {
    const apiKey = getApiKey(model.provider);
    if (!apiKey) {
      errors.push(`${model.provider}: missing API key`);
      continue;
    }

    try {
      if (model.provider === 'openai') {
        return await callOpenAiChat(apiKey, model, input.systemPrompt, input.history, input.userPrompt);
      }
      if (model.provider === 'anthropic') {
        return await callAnthropicChat(apiKey, model, input.systemPrompt, input.history, input.userPrompt);
      }
      return await callGeminiChat(apiKey, model, input.systemPrompt, input.history, input.userPrompt);
    } catch (err) {
      errors.push(`${model.provider}/${model.modelId}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  throw new Error(errors.join(' | ') || 'No Sally LLM provider configured');
}
