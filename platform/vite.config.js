import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build can be served from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5174 },
  build: { outDir: 'dist' },
});
