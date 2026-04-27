import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/product-animations.css'

const CHUNK_RELOAD_GUARD_KEY = 'chunk-reload-attempted';

const reloadOnStaleChunk = () => {
	if (sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === '1') return;
	sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1');
	window.location.reload();
};

const isStaleChunkError = (message: string) =>
	message.includes('Failed to fetch dynamically imported module') ||
	message.includes('Importing a module script failed');

window.addEventListener('vite:preloadError', (event) => {
	event.preventDefault();
	reloadOnStaleChunk();
});

window.addEventListener('unhandledrejection', (event) => {
	const reason = event.reason as { message?: string } | undefined;
	const message = reason?.message ?? '';
	if (isStaleChunkError(message)) {
		event.preventDefault();
		reloadOnStaleChunk();
	}
});

createRoot(document.getElementById("root")!).render(<App />);

// Service worker disabled for mobile OAuth compatibility
// The service worker was caching OAuth redirects causing mobile login failures
// TODO: Re-enable later with proper OAuth exclusions in navigateFallbackDenylist

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.getRegistrations().then((registrations) => {
			registrations.forEach((registration) => {
				registration.unregister();
			});
		});

		if ('caches' in window) {
			caches.keys().then((cacheNames) => {
				cacheNames.forEach((cacheName) => {
					caches.delete(cacheName);
				});
			});
		}
	});
}
