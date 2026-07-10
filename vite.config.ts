import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { financeInternalAlias } from "./src/vite-finance-alias";

const financeSrcPath = path.resolve(__dirname, "suba eco sys/finance/beirut-finance-flow-main/src");
const mainSrcPath = path.resolve(__dirname, "src");
const rootNodeModules = path.resolve(__dirname, "node_modules");

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
    financeInternalAlias(financeSrcPath, mainSrcPath),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react-router",
      "react-router-dom",
      "@tanstack/react-query",
      "firebase",
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
    ],
    alias: {
      react: path.resolve(rootNodeModules, "react"),
      "react-dom": path.resolve(rootNodeModules, "react-dom"),
      "react/jsx-runtime": path.resolve(rootNodeModules, "react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(rootNodeModules, "react/jsx-dev-runtime"),
      "react-router": path.resolve(rootNodeModules, "react-router"),
      "react-router-dom": path.resolve(rootNodeModules, "react-router-dom"),
    },
  },
}));
