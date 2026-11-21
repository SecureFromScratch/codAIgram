import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(import.meta.dirname),
  optimizeDeps: {
    noDiscovery: true,
    include: [
      '@codemirror/commands',
      '@codemirror/state',
      '@codemirror/view',
      '@joint/core',
      'neverthrow',
      'react',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
    ],
  },
  resolve: {
    alias: {
      '@codaigram/bridge-protocol/client': resolve(import.meta.dirname, '../bridge-protocol/src/bridgeClient.ts'),
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:3001' } },
});
