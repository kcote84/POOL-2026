import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { parseStanding, parseRoster } from '../../server/parser';
const standing = parseStanding(await readFile(new URL('../fixtures/standing.html', import.meta.url), 'utf8'));
const p = standing.participants.find(p => p.name === 'Sir Jorah')!;
const roster = parseRoster(await readFile(new URL(`../fixtures/roster-${p.id}.html`, import.meta.url), 'utf8'), p, standing.season);
const meta = { fetchedAt: new Date().toISOString(), stale: false, refreshing: false, error: null, source: 'marqueur', intervalMinutes: 15, nextAttemptAt: null };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/history', route => route.fulfill({ json: { data: { season: standing.season, records: [] }, meta } }));
  await page.route('**/api/standing', r => r.fulfill({json:{data:standing,meta}}));
  await page.route('**/api/daily', r => r.fulfill({json:{data:null,meta}}));
  await page.route('**/api/rosters/*', r => r.fulfill({json:{data:roster,meta}}));
});
test('PJ et moyenne du classement, recherche et totaux Panthers', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const row = page.getByRole('row').filter({has:page.getByRole('link',{name:p.name,exact:true})});
  await expect(row.locator('.ranking-games strong')).toHaveText(String(p.games));
  await expect(row.locator('.ranking-average strong')).toHaveText(new Intl.NumberFormat('fr-CA',{minimumFractionDigits:2}).format(p.average));
  await page.getByRole('link',{name:`Voir la formation de ${p.name}`}).click();
  await page.getByRole('tab',{name:/équipes/i}).click();
  const florida = page.getByRole('row').filter({hasText:'Florida Panthers'});
  await expect(florida.locator('.pool-total')).toHaveText('2');
  await expect(page.locator('tfoot td').nth(1)).toHaveText('1');
  await expect(page.locator('tfoot td').nth(2)).toHaveText('2,00');
  await page.getByLabel('Rechercher une sélection').fill('FLA');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Rechercher une sélection').fill('inexistant');
  await expect(page.locator('tbody .selection-name')).toHaveCount(0);
  await expect(page.locator('.roster-results')).toContainText('0 sélection');
  await expect(page.getByText('Aucune sélection ne correspond à votre recherche.')).toBeVisible();
  await expect(page.locator('tfoot .pool-total')).toHaveText('2');
  await page.getByLabel('Rechercher une sélection').fill('');
  await page.getByLabel('Trier par').selectOption('average');
  await expect(page.locator('tbody tr').first()).toContainText('Florida Panthers');
});
test('introduction : feu, bouton, fermeture et une seule fois par session', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.dragon-image')).toHaveJSProperty('complete',true);
  await expect(page.locator('.dragon-fire')).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.waitForTimeout(1700);
  await page.screenshot({path:'test-results/dragon-1440.png'});
  await page.getByRole('button',{name:'Entrer dans le royaume'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('introduction mobile : fermeture automatique et préférence de mouvement', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(1700);
  await page.screenshot({path:'test-results/dragon-390.png'});
  await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:8000});
  await page.evaluate(()=>sessionStorage.clear());
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('ma maison est mémorisée et les détails des points restent ceux de Marqueur', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByLabel('Ma maison', {exact:true}).selectOption(p.id);
  await page.getByRole('link', {name:'Ma formation', exact:true}).click();
  await expect(page.getByRole('heading', {name:p.name,exact:true})).toBeVisible();
  await page.goto('/');
  await expect(page.getByLabel('Ma maison', {exact:true})).toHaveValue(p.id);
  await page.getByText('Répartition des points par catégorie', {exact:true}).click();
  const details = page.locator('.breakdown-house').filter({hasText:p.name});
  await expect(details.locator('dd')).toHaveText([String(p.players),String(p.goalies),String(p.teams)]);
});
test('introduction : navigation clavier, fermeture par Échap et possibilité de revoir', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');
  const skip = page.getByRole('button',{name:'Entrer dans le royaume'});
  await expect(skip).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Revoir le dragon'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('un fichier dragon absent ne bloque jamais les résultats', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.route('**/dragon.webp', route=>route.abort('failed'));
  await page.goto('/');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link',{name:`Voir la formation de ${p.name}`})).toBeVisible();
});

for (const width of [320,390,1440]) test(`historique et barème à ${width}px`, async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width,height:844});
  const records=[
    {date:'2026-09-29',observedAt:'2026-09-29T20:00:00Z',participants:standing.participants.map(p=>({...p,points:p.points-1}))},
    {date:'2026-09-30',observedAt:'2026-09-30T20:00:00Z',participants:standing.participants},
  ];
  await page.route('**/api/history', r=>r.fulfill({json:{data:{season:standing.season,records},meta}}));
  await page.goto('/');
  await page.getByText('Historique du classement',{exact:true}).click();
  await expect(page.getByLabel('Journée du relevé')).toHaveValue('2026-09-30');
  const history=page.locator('.history-card');
  const row=history.getByRole('row').filter({hasText:'Sir Jorah'});
  await expect(row.locator('td').nth(1)).toHaveText('10');
  await expect(row.locator('td').nth(2)).toHaveText('+1');
  await page.getByLabel('Journée du relevé').selectOption('2026-09-29');
  await expect(row.locator('td').nth(1)).toHaveText('9');
  await expect(row.locator('td').nth(2)).toHaveText('—');
  await page.getByText('Comprendre les points et le barème',{exact:true}).click();
  const panthers=page.locator('.scoring-examples article').filter({hasText:'Florida Panthers'});
  await expect(panthers.locator('strong')).toHaveText('2 points du pool');
  await expect(panthers.getByText('VP',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:`test-results/history-rules-${width}.png`,fullPage:true});
});
