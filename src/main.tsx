import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Service worker disabled for mobile OAuth compatibility
// The service worker was caching OAuth redirects causing mobile login failures
// TODO: Re-enable later with proper OAuth exclusions in navigateFallbackDenylist
