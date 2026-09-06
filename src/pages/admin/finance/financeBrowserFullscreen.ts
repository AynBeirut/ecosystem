export function getFullscreenElement(): Element | null {
  return (
    document.fullscreenElement
    ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
    ?? null
  );
}

export function isFinanceBrowserFullscreen(): boolean {
  return Boolean(getFullscreenElement());
}

async function requestElementFullscreen(element: Element): Promise<void> {
  const el = element as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!request) throw new Error('Fullscreen not supported');
  await request.call(el);
}

export function clearFinanceBrowserFullscreen(): void {
  document.documentElement.classList.remove('finance-browser-fullscreen');
}

export async function exitFinanceBrowserFullscreen(): Promise<void> {
  clearFinanceBrowserFullscreen();
  if (!getFullscreenElement()) return;
  const exit =
    document.exitFullscreen
    ?? (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen;
  if (!exit) return;
  await exit.call(document);
}

export async function toggleFinanceBrowserFullscreen(): Promise<void> {
  try {
    if (getFullscreenElement()) {
      await exitFinanceBrowserFullscreen();
    } else {
      await requestElementFullscreen(document.documentElement);
      document.documentElement.classList.add('finance-browser-fullscreen');
    }
  } catch {
    /* user denied or browser blocked */
  }
}

export function subscribeFinanceBrowserFullscreen(onStoreChange: () => void): () => void {
  const handler = () => {
    if (!getFullscreenElement()) {
      clearFinanceBrowserFullscreen();
    }
    onStoreChange();
  };
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
