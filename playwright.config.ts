import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui', timeout: 30_000, workers: 1,
  use: { baseURL: 'http://localhost:5173', browserName: 'chromium', headless: true },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
});
