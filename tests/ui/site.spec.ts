import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { parseStanding, parseRoster } from '../../server/parser';

const standing = parseStanding(await readFile(new URL('../fixtures/standing.html', import.meta.url), 'utf8'));
const rosters = Object.fromEntries(await Promise.all(standing.participants.map(async p => [p.id, parseRoster(await readFile(new URL(`../fixtures/roster-${p.id}.html`, import.meta.url), 'utf8'), p, standing.season)])));
const meta = { fetchedAt: new Date().toISOString(), stale: false, refreshing: false, error: null, source: 'marqueur', intervalMinutes: 15, nextAttemptAt: null };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/history', route => route.fulfill({ json: { data: { season: standing.season, records: [] }, meta } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/standing', route => route.fulfill({ json: { data: standing, meta } }));
  await page.route('**/api/rosters/*', route => route.fulfill({ json: { data: rosters[route.request().url().split('/').pop()!], meta } }));
});
for (const width of [320, 390, 768, 1440]) test(`classement, formations et navigation à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'La course au Trône de fer' })).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(8);
  for (const p of standing.participants) {
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: p.name, exact: true }) });
    await expect(row.locator('.points')).toHaveText(String(p.points)+'pts');
    await expect(row.locator('.gap')).toHaveText(p.gap === 0 ? '—' : String(p.gap));
    await expect(row.locator('.ranking-games strong')).toHaveText(String(p.games));
    await expect(row.locator('.ranking-average strong')).toHaveText(new Intl.NumberFormat('fr-CA', {minimumFractionDigits:2}).format(p.average));
    if (width <= 700) for (const stat of ['.ranking-games', '.ranking-average']) {
      const box = await row.locator(stat).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: `test-results/classement-${width}.png`, fullPage: true });
  await page.getByRole('link', { name: 'Voir la formation de Greyworm' }).click();
  await expect(page.getByRole('heading', { name: 'Greyworm', exact: true })).toBeVisible();
  await expect(page.locator('.roster-total strong')).toHaveText(String(rosters['1252751'].total));
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(22);
  const pointsBox = await page.getByRole('columnheader', { name: 'PTS POOL' }).boundingBox();
  const scrollBox = await page.locator('.roster-scroll').boundingBox();
  expect(pointsBox!.x + pointsBox!.width).toBeLessThanOrEqual(scrollBox!.x + scrollBox!.width);
  await page.getByRole('tab', { name: /gardiens/i }).click();
  await expect(page.getByRole('heading', { name: 'Les gardiens de la maison' })).toBeVisible();
  await expect(page.getByRole('table').locator('tfoot .pool-total')).toHaveText('4');
  await page.getByRole('tab', { name: /équipes/i }).click();
  await expect(page.getByRole('table').locator('tfoot .pool-total')).toHaveText('0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({ path: `test-results/formation-${width}.png`, fullPage: true });
  await page.getByRole('link', { name: 'Retour au classement' }).click();
  await expect(page.getByRole('heading', { name: 'Les prétendants au trône' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('accès clavier au contenu et navigation entre onglets', async ({ page }) => {
  await page.goto('/'); await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused();
  await page.goto('/formation/1252751');
  const players = page.getByRole('tab', { name: /joueurs/i }); await players.focus();
  await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: /gardiens/i })).toBeFocused();
  await expect(page.getByRole('tab', { name: /gardiens/i })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End'); await expect(page.getByRole('tab', { name: /équipes/i })).toBeFocused();
});
test('affiche les données anciennes et la panne tout en conservant les sept scores', async ({ page }) => {
  await page.route('**/api/standing', r => r.fulfill({ json: { data: standing, meta: { ...meta, fetchedAt: '2020-01-01T00:00:00Z', stale: true, error: 'Marqueur répond HTTP 503.' } } }));
  await page.goto('/'); await expect(page.getByText('Données anciennes')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Dernier résultat valide conservé');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(8);
});
test('première récupération et indisponibilité sans résultats fictifs', async ({ page }) => {
  await page.route('**/api/standing', r => r.fulfill({ json: { data: null, meta: { ...meta, fetchedAt: null, refreshing: true } } }));
  await page.goto('/'); await expect(page.getByRole('heading', { name: /Les corbeaux/ })).toBeVisible(); await expect(page.getByRole('table')).toHaveCount(0);
  await page.route('**/api/standing', r => r.fulfill({ json: { data: null, meta: { ...meta, fetchedAt: null, error: 'Marqueur répond HTTP 503.' } } }));
  await page.reload(); await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await expect(page.getByText('Marqueur répond HTTP 503.')).toBeVisible(); await expect(page.getByRole('table')).toHaveCount(0);
});
test('une panne du serveur après chargement conserve les résultats dans le navigateur', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('table')).toBeVisible();
  await page.route('**/api/standing', r => r.abort('connectionfailed'));
  await page.getByRole('button', { name: 'Vérifier les nouvelles' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(8);
});
test('formations, retrait des batailles et anciens liens', async ({ page }) => {
  await page.goto('/formations'); await expect(page.locator('.house-card')).toHaveCount(7);
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link')).toHaveCount(2);
  await page.goto('/batailles');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'La course au Trône de fer' })).toBeVisible();
  await expect(page.getByText(/batailles du jour/i)).toHaveCount(0);
  await expect(page.locator('.daily-card')).toHaveCount(0);
  await page.goto('/formation/999'); await expect(page.getByText('Ce prétendant ne figure pas dans notre pool.')).toBeVisible();
});
test('contrastes, structure et libellés accessibles sur téléphone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/formations', '/formation/1252751']) {
    await page.goto(path); await expect(page.locator('.source-bar')).toBeVisible();
    const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(report.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  }
});
