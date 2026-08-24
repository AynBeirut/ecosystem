type CursorRunStatus = 'CREATING' | 'RUNNING' | 'FINISHED' | 'FAILED' | 'CANCELLED';

export type CursorModelConfig = {
  id: string;
  params?: Array<{ id: string; value: string }>;
};

export type CursorPromptOptions = {
  timeoutMs?: number;
  pollMs?: number;
  agentName?: string;
  model?: CursorModelConfig;
};

type CursorCreateResponse = {
  agent?: { id?: string; latestRunId?: string };
  run?: { id?: string; status?: CursorRunStatus };
};

type CursorRunResponse = {
  status?: CursorRunStatus;
  result?: string;
};

function authHeader(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a one-shot no-repo Cursor Cloud Agent prompt and return the final text result.
 */
/** Sally / Grabio Guide — single model, fast + cheap. */
export const GRABIO_GUIDE_CURSOR_MODEL: CursorModelConfig = {
  id: 'composer-2.5',
  params: [{ id: 'fast', value: 'true' }],
};

/** Other Cursor agent models (consulting / SEO / future — pass per request). */
export const CURSOR_AGENT_MODELS = {
  guide: GRABIO_GUIDE_CURSOR_MODEL,
  /** Example: heavier tasks when consulting tier is enabled */
  default: { id: 'composer-2.5', params: [{ id: 'fast', value: 'false' }] },
} as const;

export async function runCursorTextPrompt(
  apiKey: string,
  prompt: string,
  options?: CursorPromptOptions,
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const pollMs = options?.pollMs ?? 2_000;
  const started = Date.now();

  const body: Record<string, unknown> = {
    name: options?.agentName || 'grabio-seo-draft',
    prompt: { text: prompt },
  };
  if (options?.model) {
    body.model = options.model;
  }

  const createRes = await fetch('https://api.cursor.com/v1/agents', {
    method: 'POST',
    headers: authHeader(apiKey),
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const errBody = (await createRes.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String(errBody.message || errBody.error || `Cursor agent create failed (${createRes.status})`));
  }

  const created = (await createRes.json()) as CursorCreateResponse;
  const agentId = created.agent?.id;
  const runId = created.run?.id || created.agent?.latestRunId;
  if (!agentId || !runId) throw new Error('Cursor agent create returned no run id');

  while (Date.now() - started < timeoutMs) {
    const runRes = await fetch(`https://api.cursor.com/v1/agents/${agentId}/runs/${runId}`, {
      headers: authHeader(apiKey),
    });
    if (!runRes.ok) {
      throw new Error(`Cursor run poll failed (${runRes.status})`);
    }

    const run = (await runRes.json()) as CursorRunResponse;
    if (run.status === 'FINISHED') {
      const text = String(run.result || '').trim();
      if (!text) throw new Error('Cursor agent finished with empty result');
      return text;
    }
    if (run.status === 'FAILED' || run.status === 'CANCELLED') {
      throw new Error(`Cursor agent run ${run.status?.toLowerCase()}`);
    }

    await sleep(pollMs);
  }

  throw new Error('Cursor agent timed out — try again or shorten the prompt');
}
