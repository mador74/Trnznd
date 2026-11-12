import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any sub-path (e.g. GitHub Pages /Trnznd/reconcile/).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5174 },
  // The claude.ai artifact build inlines fonts and icons so the page needs no extra font files.
  build: process.env.VITE_HOSTED_PREVIEW === '1' ? { outDir: 'dist-artifact', assetsInlineLimit: 10_000_000 } : {},
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
