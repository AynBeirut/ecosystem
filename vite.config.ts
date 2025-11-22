import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Bind to all addresses for network access, but explicitly set HMR host
    // so the client will connect via localhost over WebSocket (avoids some
    // environments where automatic host detection causes WS failures).
    host: "::",
    port: 8080,
    hmr: {
      host: 'localhost',
      clientPort: 8080,
    },
    // Proxy '/api' to the functions emulator in development so fetch('/api/checkout')
    // hits the local function instead of returning the Vite index.html page.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5002/market-flow-7b074/us-central1/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
