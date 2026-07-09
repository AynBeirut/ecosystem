import { createRoot } from 'react-dom/client'
import App from './App'
import EditorPreviewRoot, { isEditorEmbedFrame } from './embed/EditorPreviewRoot'
import './index.css'
import './styles/product-animations.css'
import { runPwaCleanupOnce } from './lib/pwaCleanup'

runPwaCleanupOnce();

/** After deploy, stale cached index.js points at removed chunks → import fails. Reload once. */
const CHUNK_RELOAD_KEY = 'grabio_chunk_reload_v1';
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { message?: string } | undefined;
  const message = String(reason?.message ?? reason ?? '');
  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  ) {
    if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
      window.location.reload();
    }
  }
});

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
