import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseStanding, parseRoster } from '../../server/parser';
import AxeBuilder from '@axe-core/playwright';

const standing = parseStanding(await readFile(new URL('../fixtures/standing.html', import.meta.url), 'utf8'));
const rosters = Object.fromEntries(await Promise.all(standing.participants.map(async p => [p.id, parseRoster(await readFile(new URL(`../fixtures/roster-${p.id}.html`, import.meta.url), 'utf8'), p, standing.season)])));
const meta = { fetchedAt: new Date().toISOString(), stale: false, refreshing: false, error: null, source: 'marqueur', intervalMinutes: 15, staleAfterMinutes: 45, nextAttemptAt: null };
test.use({ baseURL: 'http://localhost:4173' });
test.beforeEach(async ({ page }) => {
  await page.route('**/POOL-2026/data/history.json', route => route.fulfill({ json: { data: { season: standing.season, records: [] }, meta } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/POOL-2026/data/standing.json', r => r.fulfill({ json: { data: standing, meta } }));
  await page.route('**/POOL-2026/data/daily.json', r => r.fulfill({ json: { data: null, meta: { ...meta, fetchedAt: null, error: 'Non daté.' } } }));
  await page.route('**/POOL-2026/data/roster-*.json', r => {
    const id = r.request().url().match(/roster-(\d+)\.json/)?.[1];
    return r.fulfill({ json: { data: id ? rosters[id] ?? null : null, meta } });
  });
});
for (const width of [320, 390, 1440]) test(`site compilé Pages sous /POOL-2026/ à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const forbiddenRequests: string[] = []; page.on('request', r => { if (r.url().includes('/api/') || r.url().includes('marqueur.com')) forbiddenRequests.push(r.url()); });
  await page.goto('/POOL-2026/');
  await expect(page.getByRole('heading', { name: 'La course au Trône de fer' })).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(8);
  const steve = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Ned Stark', exact: true }) });
  await expect(steve.locator('.real-name')).toHaveText('Steve');
  await expect(steve.getByRole('img', { name: 'Portrait de Arya Stark' })).toBeVisible();
  await expect(steve.getByRole('img', { name: 'Portrait de Arya Stark' })).toHaveJSProperty('complete', true);
  expect(await steve.getByRole('img', { name: 'Portrait de Arya Stark' }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  expect(await page.locator('.hero-art').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('/POOL-2026/fortress.svg');
  await page.getByRole('link', { name: 'Voir la formation de Greyworm' }).click();
  await expect(page).toHaveURL(/\/POOL-2026\/#\/formation\/1252751$/);
  await expect(page.locator('.roster-total strong')).toHaveText('5');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Greyworm', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Aller au contenu' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused(); await expect(page).toHaveURL(/\/POOL-2026\/#\/formation\/1252751$/);
  await page.getByRole('tab', { name: /gardiens/i }).click(); await expect(page.locator('tfoot .pool-total')).toHaveText('4');
  await page.getByRole('link', { name: 'Retour au classement' }).click();
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Formations', exact: true }).click();
  await expect(page.locator('.house-card')).toHaveCount(7);
  await page.goBack(); await expect(page.getByRole('heading', { name: 'La course au Trône de fer' })).toBeVisible();
  await page.screenshot({ path: `test-results/pages-${width}.png`, fullPage: true });
  expect(errors).toEqual([]); expect(forbiddenRequests).toEqual([]);
});
test('Pages : un fichier statique devient ancien sans attendre une nouvelle compilation', async ({ page }) => {
  await page.route('**/POOL-2026/data/standing.json', r => r.fulfill({ json: { data: standing, meta: { ...meta, stale: false, fetchedAt: new Date(Date.now() - 46 * 60_000).toISOString() } } }));
  await page.goto('/POOL-2026/'); await expect(page.getByText('Données anciennes')).toBeVisible(); await expect(page.getByRole('table')).toBeVisible();
});
test('Pages : contrastes et structure accessibles sur téléphone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/POOL-2026/'); await expect(page.locator('.source-bar')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

for (const width of [320,390,1440]) test(`Pages : historique et barème dépliés à ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  const records=[{date:'2026-09-30',observedAt:meta.fetchedAt,participants:standing.participants}];
  await page.route('**/POOL-2026/data/history.json', route=>route.fulfill({json:{data:{season:standing.season,records},meta}}));
  await page.goto('/POOL-2026/');
  await page.getByText('Historique du classement',{exact:true}).click();
  await expect(page.locator('.history-table tbody tr')).toHaveCount(7);
  await page.getByText('Comprendre les points et le barème',{exact:true}).click();
  await expect(page.locator('.scoring-examples article')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
});
