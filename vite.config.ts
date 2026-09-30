import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/POOL-2026/' : '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
}));
