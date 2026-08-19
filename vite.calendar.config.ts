import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'calendar-app'),
  envDir: __dirname,
  base: '/calendario-consultas/',
  plugins: [react(), tailwindcss()],
  publicDir: resolve(__dirname, 'public'),
  server: {
    fs: {
      allow: [resolve(__dirname)],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist-calendar'),
    emptyOutDir: true,
  },
});
