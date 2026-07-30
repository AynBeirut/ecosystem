import { createRoot } from 'react-dom/client'
import App from './App'
import EditorPreviewRoot, { isEditorEmbedFrame } from './embed/EditorPreviewRoot'
import './index.css'
import './styles/product-animations.css'
import { runPwaCleanupOnce } from './lib/pwaCleanup'

runPwaCleanupOnce();

/** After deploy, stale cached entry/chunks → dynamic import fails. Reload with cache-bust (see index.html). */
const CHUNK_RELOAD_KEY = 'grabio_chunk_reload_v3';
const MAX_CHUNK_RELOADS = 3;

function hardRecoverFromStaleChunk(force = false): void {
  let count = 0;
  try {
    count = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10);
  } catch {
    /* ignore */
  }
  if (!force && count >= MAX_CHUNK_RELOADS) return;
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(count + 1));
  } catch {
    /* ignore */
  }

  let done = false;
  const reloadNow = () => {
    if (done) return;
    done = true;
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  };

  const tasks: Promise<unknown>[] = [];
  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      ),
    );
  }
  if ('caches' in window) {
    tasks.push(
      caches.keys().then((cacheNames) =>
        Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))),
      ),
    );
  }

  if (tasks.length) {
    Promise.all(tasks).finally(reloadNow);
    window.setTimeout(reloadNow, 1200);
  } else {
    reloadNow();
  }
}

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { message?: string } | undefined;
  const message = String(reason?.message ?? reason ?? '');
  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  ) {
    event.preventDefault();
    hardRecoverFromStaleChunk();
  }
});
window.addEventListener(
  'error',
  (event) => {
    const target = event.target;
    if (
      target instanceof HTMLScriptElement &&
      target.src.includes('/assets/')
    ) {
      hardRecoverFromStaleChunk();
    }
  },
  true,
);

const NATIVE_BUTTON_COOLDOWN_MS = 1200;

const installNativeButtonClickGuard = () => {
	const clickLockMap = new WeakMap<HTMLButtonElement, number>();

	document.addEventListener(
		'click',
		(event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;

			const button = target.closest('button') as HTMLButtonElement | null;
			if (!button) return;
			if (button.dataset.allowMultiClick === 'true') return;
			if (button.disabled) return;

			const now = Date.now();
			const lockedUntil = clickLockMap.get(button) ?? 0;
			if (now < lockedUntil) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			clickLockMap.set(button, now + NATIVE_BUTTON_COOLDOWN_MS);
			button.classList.add('native-button-click-guard');
			window.setTimeout(() => {
				button.classList.remove('native-button-click-guard');
			}, NATIVE_BUTTON_COOLDOWN_MS);
		},
		true,
	);
};

installNativeButtonClickGuard();

createRoot(document.getElementById("root")!).render(
  isEditorEmbedFrame() ? <EditorPreviewRoot /> : <App />,
);
