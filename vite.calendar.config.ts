import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(projectDir, 'calendar-app'),
  envDir: projectDir,
  base: '/calendario-consultas/',
  plugins: [react(), tailwindcss()],
  publicDir: resolve(projectDir, 'public'),
  server: {
    fs: {
      allow: [resolve(projectDir)],
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
    outDir: resolve(projectDir, 'dist-calendar'),
    emptyOutDir: true,
  },
});
