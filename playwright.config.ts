import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui', timeout: 30_000, workers: 1,
  use: { baseURL: 'http://localhost:5173', browserName: 'chromium', headless: true },
  webServer: [
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run build:pages && npx vite preview --mode pages --host 127.0.0.1 --port 4173', url: 'http://localhost:4173/POOL-2026/', reuseExistingServer: false, timeout: 60_000 },
  ],
});
