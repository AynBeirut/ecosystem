import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { bootstrapPlayStoreShell } from '@/lib/playStoreNavScope'
import { disableServiceWorkerInAppShell } from '@/lib/appShell'

bootstrapPlayStoreShell()
void disableServiceWorkerInAppShell()

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(<App />);

// Remove native splash once React has mounted
requestAnimationFrame(() => {
  const splash = document.getElementById('app-splash');
  if (splash) splash.style.display = 'none';
});
