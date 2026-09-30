import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import { load } from 'cheerio';
import { number, parseStanding, parseRoster, parseDaily, safeSource, STANDING_URL, DAILY_URL } from '../server/parser';
import { PoolCache, httpFetcher, validateSnapshot, type FetchHtml } from '../server/cache';

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const standingHtml = await fixture('standing');
const dailyHtml = await fixture('daily');
const standing = parseStanding(standingHtml);
const rosterHtml = new Map(await Promise.all(standing.participants.map(async p => [p.id, await fixture(`roster-${p.id}`)] as const)));
const fixtureFetcher: FetchHtml = async url => {
  if (url === STANDING_URL) return standingHtml;
  if (url === DAILY_URL) return dailyHtml;
  const html = rosterHtml.get(new URL(url).searchParams.get('no')!.split('|')[0]);
  if (!html) throw new Error('Fixture introuvable.');
  return html;
};
async function createCache(fetcher = fixtureFetcher) {
  const dir = await mkdtemp(join(tmpdir(), 'keven-pool-test-'));
  return new PoolCache({ intervalMs: 1, staleMs: 60_000, timeoutMs: 1000, cacheFile: join(dir, 'cache.json') }, fetcher);
}
test('extrait sept noms exacts, liens de formations, totaux et écarts de la capture réelle', () => {
  assert.equal(standing.participants.length, 7);
  assert.equal(standing.season, '2026-2027');
  assert.ok(standing.participants.some(p => p.name === 'Sandor Cleagan'));
  assert.equal(standing.participants[0].name, 'Podrick Payne');
  for (const p of standing.participants) {
    assert.equal(new URL(p.sourceUrl).searchParams.get('no')?.split('|')[0], p.id);
    assert.equal(p.gap, standing.participants[0].points - p.points);
    assert.equal(p.points, p.players + p.goalies + p.teams);
  }
});
test('les sept formations ont les catégories attendues et le total Marqueur du classement', () => {
  for (const p of standing.participants) {
    const roster = parseRoster(rosterHtml.get(p.id)!, p, standing.season);
    assert.deepEqual(roster.groups.map(g => g.name), ['JOUEURS', 'GARDIENS', 'ÉQUIPES']);
    assert.equal(roster.groups.map(g => g.entries.length).reduce((a, b) => a + b), 24);
    assert.equal(roster.total, p.points);
    assert.equal(roster.groups.find(g => g.name === 'GARDIENS')!.total, p.goalies);
    assert.equal(roster.groups.find(g => g.name === 'ÉQUIPES')!.total, p.teams);
    assert.equal(roster.groups.find(g => g.name === 'JOUEURS')!.total, p.players);
  }
});
test('les points des gardiens proviennent de TOT, distinct de leurs victoires', () => {
  const grey = standing.participants.find(p => p.name === 'Greyworm')!;
  const goalies = parseRoster(rosterHtml.get(grey.id)!, grey, standing.season).groups.find(g => g.name === 'GARDIENS')!;
  assert.equal(goalies.total, 4);
  const wins = goalies.columns.find(c => c.label === 'V')!;
  assert.equal(goalies.entries.reduce((n, e) => n + e.stats[wins.key], 0), 1);
});
test('la victoire des Panthers en prolongation vaut les deux points de TOT, sans double comptage', () => {
  const p = standing.participants.find(p => p.name === 'Sir Jorah')!;
  const teams = parseRoster(rosterHtml.get(p.id)!, p, standing.season).groups.find(g => g.name === 'ÉQUIPES')!;
  const florida = teams.entries.find(e => e.name === 'Florida Panthers')!;
  const stat = (label: string) => florida.stats[teams.columns.find(c => c.label === label)!.key];
  assert.equal(stat('PJ'), 1); assert.equal(stat('V'), 0); assert.equal(stat('VP'), 1);
  assert.equal(florida.points, 2); assert.equal(teams.total, 2);
  assert.equal(teams.totals![teams.columns.find(c => c.label === 'MOY')!.key], 2);
});
test('refuse la capture Marqueur ancienne qui comptait une partie des Panthers comme deux victoires', async () => {
  const p = standing.participants.find(p => p.name === 'Sir Jorah')!;
  const old = await fixture('roster-panthers-double-count');
  assert.throws(() => parseRoster(old, p, standing.season), /Florida Panthers.*dépassent/);
});
test('les totaux de PJ et MOY viennent des tableaux Marqueur, avec rejet des divergences', () => {
  for (const p of standing.participants) {
    const roster = parseRoster(rosterHtml.get(p.id)!, p, standing.season);
    assert.equal(roster.groups.reduce((sum, g) => sum + g.totals![g.columns.find(c => c.label === 'PJ')!.key], 0), p.games);
    assert.throws(() => parseRoster(rosterHtml.get(p.id)!, {...p, games: p.games + 1}, standing.season), /parties jouées/);
  }
});
test('une victoire comptée deux fois ne remplace jamais les deux points Panthers déjà validés', async () => {
  let bad = false;
  const old = await fixture('roster-panthers-double-count');
  const cache = await createCache(async url => bad && new URL(url).searchParams.get('no')?.startsWith('1252756|') ? old : fixtureFetcher(url));
  await cache.refresh(); const correct = structuredClone(cache.snapshot);
  bad = true; await delay(5); await cache.refresh();
  assert.deepEqual(cache.snapshot, correct); assert.match(cache.error!, /Florida Panthers.*dépassent/);
  const corrupt = structuredClone(correct!);
  const teams = corrupt.rosters['1252756'].data.groups.find(g => g.name === 'ÉQUIPES')!;
  teams.entries[0].stats[teams.columns.find(c => c.label === 'V')!.key] = 1;
  assert.equal(validateSnapshot(corrupt), false);
  const invalidGames = structuredClone(correct!);
  const group = invalidGames.rosters['1252756'].data.groups[0];
  group.totals![group.columns.find(c => c.label === 'PJ')!.key] += 1;
  assert.equal(validateSnapshot(invalidGames), false);
});
test('les valeurs absentes affichées par un tiret sont zéro, les cellules vides sont refusées', () => {
  assert.equal(number('-'), 0); assert.equal(number('1,50'), 1.5);
  for (const value of ['', 'NaN', 'erreur', '12 points']) assert.throws(() => number(value));
});
test('refuse les pages vides, une protection d’accès, les changements de colonnes et les participants manquants', () => {
  for (const html of ['', '<h1>Connexion requise</h1>', standingHtml.replace('>TOT<', '>POINTS<'), standingHtml.replace('Sandor Cleagan', 'Sandor Clegane')]) assert.throws(() => parseStanding(html));
  const $ = load(standingHtml); $('tr.tr').last().remove(); assert.throws(() => parseStanding($.html()));
});
test('refuse les liens hors source, un autre pool ou un identifiant malformé', () => {
  for (const url of ['https://example.com/stats_03.php?nyx=219062&no=1|2', 'stats_03.php?nyx=1&no=1|2', 'stats_03.php?nyx=219062&no=broken']) assert.throws(() => safeSource(url));
});
test('refuse une formation d’un autre participant, une autre saison et des totaux divergents', () => {
  const p = standing.participants.find(p => p.name === 'Greyworm')!;
  const html = rosterHtml.get(p.id)!;
  assert.throws(() => parseRoster(html.replaceAll('GREYWORM', 'BRONN'), p, standing.season));
  assert.throws(() => parseRoster(html.replaceAll('2026-2027', '2025-2026'), p, standing.season));
  assert.throws(() => parseRoster(html, { ...p, points: 500 }, standing.season));
  assert.throws(() => parseRoster(html + '<select id="id_parametre"><option value="999" selected>Autre barème</option></select>', p, standing.season), /paramètre/);
});
test('refuse le quotidien non daté, accepte uniquement une date explicite', () => {
  assert.throws(() => parseDaily(dailyHtml), /date/);
  const $ = load(dailyHtml); $('.ee2').text('30 SEPTEMBRE 2026');
  assert.equal(parseDaily($.html(), new Date('2026-09-30T12:00:00Z')).date, '30 SEPTEMBRE 2026');
  $('.ee2').text('31 SEPTEMBRE 2026'); assert.throws(() => parseDaily($.html()), /invalide/);
  $('.ee2').text('29 SEPTEMBRE 2026'); assert.throws(() => parseDaily($.html(), new Date('2026-09-30T12:00:00Z')), /actuelle/);
});
test('cache persisté valide et rechargé au redémarrage sans dépendre de Marqueur', async () => {
  const cache = await createCache(); await cache.refresh();
  assert.ok(validateSnapshot(cache.snapshot)); assert.equal(cache.error, null);
  assert.equal(cache.snapshot!.daily, null); assert.match(cache.dailyError!, /date/);
  const restart = new PoolCache(cache.config, async () => { throw new Error('hors ligne'); });
  await restart.load(); assert.deepEqual(restart.snapshot, cache.snapshot);
});
test('une panne, une page vide ou une formation cassée ne remplace jamais le dernier cache valide', async () => {
  let failure: 'none' | 'network' | 'empty' | 'roster' = 'none';
  const cache = await createCache(async url => {
    if (failure === 'network') throw new Error('Marqueur ne répond pas.');
    if (failure === 'empty') return '';
    if (failure === 'roster' && url.includes('stats_03')) return '<html>Erreur</html>';
    return fixtureFetcher(url);
  });
  await cache.refresh(); const original = structuredClone(cache.snapshot);
  const disk = await readFile(cache.config.cacheFile, 'utf8');
  for (const state of ['network', 'empty', 'roster'] as const) {
    failure = state; await delay(5); await cache.refresh();
    assert.deepEqual(cache.snapshot, original); assert.equal(await readFile(cache.config.cacheFile, 'utf8'), disk);
    assert.ok(cache.error); assert.ok(cache.response(cache.snapshot!.standing).data);
  }
  failure = 'none'; await delay(5); await cache.refresh(); assert.equal(cache.error, null);
});
test('une panne sans cache produit un état indisponible, jamais des zéros fictifs', async () => {
  const cache = await createCache(async () => { throw new Error('HTTP 503'); });
  await cache.refresh(); assert.equal(cache.snapshot, null); assert.equal(cache.response(null).data, null); assert.ok(cache.error);
});
test('déduplique les demandes concurrentes et respecte la fréquence partagée', async () => {
  let calls = 0; let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const cache = await createCache(async url => { calls++; await gate; return fixtureFetcher(url); });
  cache.config.intervalMs = 60_000;
  const first = cache.refresh(); const second = cache.refresh(); assert.equal(first, second); assert.equal(calls, 1);
  release(); await first; assert.equal(calls, 9);
  await Promise.all(Array.from({ length: 20 }, () => cache.refresh())); assert.equal(calls, 9);
});
test('un cache ancien reste affichable avec un avertissement et un cache corrompu est rejeté', async () => {
  const cache = await createCache(); await cache.refresh();
  cache.snapshot!.standing.fetchedAt = '2020-01-01T00:00:00.000Z';
  assert.equal(cache.response(cache.snapshot!.standing).meta.stale, true);
  await writeFile(cache.config.cacheFile, '{broken');
  const restart = new PoolCache(cache.config); await restart.load(); assert.equal(restart.snapshot, null); assert.match(restart.error!, /illisible/);
});
test('le client HTTP refuse une erreur, une redirection, un faux HTML et interrompt une réponse bloquée', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/slow') return;
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/ok' }); res.end(); return; }
    if (req.url === '/error') { res.writeHead(503); res.end('Error'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address() as { port: number };
  try { for (const path of ['/error', '/redirect', '/json', '/slow']) await assert.rejects(httpFetcher(80)(`http://127.0.0.1:${address.port}${path}`)); }
  finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
