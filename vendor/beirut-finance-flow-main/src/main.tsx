import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { bootstrapPlayStoreShell } from '@/lib/playStoreNavScope'
import { runInvoicePwaCleanupOnce } from '@/lib/pwaCleanup'

runInvoicePwaCleanupOnce()

/** After deploy, stale cached index points at removed chunks → import fails. Reload once. */
const CHUNK_RELOAD_KEY = 'grabio_invoice_chunk_reload_v1'
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { message?: string } | undefined
  const message = String(reason?.message ?? reason ?? '')
  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  ) {
    if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      window.location.reload()
    }
  }
})

bootstrapPlayStoreShell()

createRoot(document.getElementById("root")!).render(<App />);
