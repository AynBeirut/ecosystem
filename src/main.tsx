import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/product-animations.css'
import { runPwaCleanupOnce } from './lib/pwaCleanup'

runPwaCleanupOnce();

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

createRoot(document.getElementById("root")!).render(<App />);
