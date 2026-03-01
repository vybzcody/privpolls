import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.wasm'],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ["@provablehq/wasm"],
    include: ["eventemitter3", "bn.js", "js-sha3", "hash.js"],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  define: {
    global: "globalThis",
  },
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
