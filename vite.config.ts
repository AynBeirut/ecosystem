import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    // Bind to all addresses for network access
    host: "0.0.0.0",
    port: 8080,
    // Proxy '/api' to the functions emulator in development so fetch('/api/checkout')
    // hits the local function instead of returning the Vite index.html page.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5002/market-flow-7b074/us-central1/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Proxy Firebase Auth handler so the redirect flow stays same-origin on localhost.
      // Without this, the SDK can't read cross-origin cookies/storage from firebaseapp.com,
      // causing onAuthStateChanged to always fire null after the redirect.
      '/__/auth': {
        target: 'https://market-flow-7b074.firebaseapp.com',
        changeOrigin: true,
        secure: true,
      },
      '/__/firebase': {
        target: 'https://market-flow-7b074.firebaseapp.com',
        changeOrigin: true,
        secure: true,
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
