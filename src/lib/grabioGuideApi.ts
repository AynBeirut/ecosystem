import { getApiBaseUrl } from '@/lib/apiBase';

export type GrabioGuideMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type GrabioGuideResponse = {
  success: boolean;
  content?: string;
  message?: string;
  skipped?: boolean;
  reason?: string;
  redirectTo?: string;
  toolLabel?: string;
  humanHandoff?: { whatsappUrl: string; reason?: string };
};

const GUIDE_REQUEST_TIMEOUT_MS = 90_000;

export async function queryGrabioGuide(input: {
  token: string;
  storeId: string;
  prompt: string;
  page: string;
  storeName?: string | null;
  history: GrabioGuideMessage[];
}): Promise<GrabioGuideResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), GUIDE_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${getApiBaseUrl()}/agent/guide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.token}`,
      },
      body: JSON.stringify({
        storeId: input.storeId,
        prompt: input.prompt,
        context: { page: input.page, storeName: input.storeName || undefined },
        history: input.history,
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as GrabioGuideResponse;
    if (!res.ok) {
      if (data.humanHandoff?.whatsappUrl && data.content) {
        return { ...data, success: true };
      }
      return {
        success: false,
        message: data.message || `Request failed (${res.status})`,
        humanHandoff: data.humanHandoff,
        content: data.content,
      };
    }
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, message: 'Sally took too long — try a shorter question.' };
    }
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, message };
  } finally {
    window.clearTimeout(timeout);
  }
}
