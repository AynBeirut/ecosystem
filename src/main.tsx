import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/product-animations.css'

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
