import { defineConfig } from 'vite';

// Base is relative so the production build is portable and can be served
// from any sub-path (e.g. `npx serve dist`) or a static host.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep the background video as a real file, never inlined
  },
});
