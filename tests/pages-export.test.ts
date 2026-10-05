import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import { PoolCache } from '../server/cache';
import { exportPages } from '../server/export-pages';
import { STANDING_URL, DAILY_URL } from '../server/parser';
import { currentMeta, dailyStale, morningCollected } from '../shared/freshness';
import type { ApiResponse, Standing, SyncMeta } from '../shared/types';

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'pool-pages-'));
  let fail = false;
  const cache = new PoolCache({ intervalMs: 1, staleMs: 60_000, timeoutMs: 1000, cacheFile: join(dir, 'cache.json') }, async url => {
    if (fail) throw new Error('Marqueur répond HTTP 503.');
    const name = url === STANDING_URL ? 'standing' : url === DAILY_URL ? 'daily' : `roster-${new URL(url).searchParams.get('no')!.split('|')[0]}`;
    return readFile(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
  });
  return { cache, output: join(dir, 'data'), fail: () => { fail = true; } };
}
test('export Pages : sept formations réelles, points et horodatages identiques au cache', async () => {
  const { cache, output } = await setup(); await exportPages(cache, output);
  const standing: ApiResponse<Standing> = JSON.parse(await readFile(join(output, 'standing.json'), 'utf8'));
  assert.deepEqual(standing.data, cache.snapshot!.standing.data); assert.equal(standing.meta.fetchedAt, cache.snapshot!.standing.fetchedAt);
  for (const p of standing.data!.participants) {
    const roster = JSON.parse(await readFile(join(output, `roster-${p.id}.json`), 'utf8'));
    assert.equal(roster.data.total, p.points); assert.equal(roster.data.name, p.name);
  }
  assert.deepEqual(JSON.parse(await readFile(join(output, 'history.json'), 'utf8')).data, cache.snapshot!.history);
  assert.deepEqual(JSON.parse(await readFile(join(output, 'snapshot.json'), 'utf8')), cache.snapshot);
  assert.equal(JSON.parse(await readFile(join(output, 'daily.json'), 'utf8')).data, null);
});
test('export Pages après panne : conserve les scores et leur date, publie l’avertissement', async () => {
  const { cache, output, fail } = await setup(); await exportPages(cache, output);
  const original = structuredClone(cache.snapshot); fail(); await delay(5); await exportPages(cache, output);
  const result = JSON.parse(await readFile(join(output, 'standing.json'), 'utf8'));
  assert.deepEqual(result.data, original!.standing.data); assert.equal(result.meta.fetchedAt, original!.standing.fetchedAt); assert.match(result.meta.error, /503/);
});
test('export Pages sans cache et sans Marqueur : état indisponible explicite, aucun score inventé', async () => {
  const { cache, output, fail } = await setup(); fail(); await exportPages(cache, output);
  const result = JSON.parse(await readFile(join(output, 'standing.json'), 'utf8'));
  assert.equal(result.data, null); assert.equal(result.meta.fetchedAt, null); assert.match(result.meta.error, /503/);
});
test('un runner sans cache peut restaurer le dernier instantané publié avant une panne Marqueur', async () => {
  const original = await setup(); await exportPages(original.cache, original.output);
  const snapshot = JSON.stringify(original.cache.snapshot);
  const seed = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(snapshot); });
  await new Promise<void>(r => seed.listen(0, '127.0.0.1', r));
  try {
    const next = await setup(); next.fail();
    await exportPages(next.cache, next.output, `http://127.0.0.1:${(seed.address() as { port: number }).port}/snapshot.json`);
    const result = JSON.parse(await readFile(join(next.output, 'standing.json'), 'utf8'));
    assert.deepEqual(result.data, original.cache.snapshot!.standing.data); assert.equal(result.meta.fetchedAt, original.cache.snapshot!.standing.fetchedAt);
  } finally { seed.closeAllConnections(); await new Promise<void>(r => seed.close(() => r())); }
});
test('la fraîcheur d’un instantané statique est recalculée même si sa publication s’arrête', () => {
  const meta: SyncMeta = { fetchedAt: '2026-09-30T12:00:00Z', stale: false, refreshing: false, error: null, intervalMinutes: 15, staleAfterMinutes: 45, source: 'marqueur', nextAttemptAt: null };
  assert.equal(currentMeta(meta, Date.parse('2026-09-30T12:30:00Z')).stale, false);
  assert.equal(currentMeta(meta, Date.parse('2026-09-30T12:46:00Z')).stale, true);
});


test('horaire quotidien : échéance et secours à Montréal, été et hiver', () => {
  assert.equal(morningCollected('2026-10-02T08:59:59Z', Date.parse('2026-10-02T10:00:00Z')), false);
  assert.equal(morningCollected('2026-10-02T09:00:00Z', Date.parse('2026-10-02T10:00:00Z')), true);
  assert.equal(morningCollected('2026-10-01T09:00:00Z', Date.parse('2026-10-02T10:00:00Z')), false);
  assert.equal(dailyStale('2026-10-01T09:01:00Z', Date.parse('2026-10-02T10:59:59Z')), false);
  assert.equal(dailyStale('2026-10-01T09:01:00Z', Date.parse('2026-10-02T11:00:00Z')), true);
  assert.equal(dailyStale('2026-10-02T09:00:00Z', Date.parse('2026-10-02T23:00:00Z')), false);
  assert.equal(dailyStale('2026-10-02T08:59:59Z', Date.parse('2026-10-02T11:00:00Z')), true);
  assert.equal(morningCollected('2026-12-02T09:59:59Z', Date.parse('2026-12-02T11:00:00Z')), false);
  assert.equal(morningCollected('2026-12-02T10:00:00Z', Date.parse('2026-12-02T11:00:00Z')), true);
  assert.equal(dailyStale('2026-10-31T09:01:00Z', Date.parse('2026-11-01T11:59:59Z')), false);
  assert.equal(dailyStale('2026-10-31T09:01:00Z', Date.parse('2026-11-01T12:00:00Z')), true);
  assert.equal(dailyStale('2026-03-07T10:01:00Z', Date.parse('2026-03-08T10:59:59Z')), false);
  assert.equal(dailyStale('2026-03-07T10:01:00Z', Date.parse('2026-03-08T11:00:00Z')), true);
  assert.equal(dailyStale(null), true);
});
test('export quotidien : secours sans requête, lancement manuel forcé et échec signalé', async () => {
  const { cache, output, fail } = await setup();
  await exportPages(cache, output);
  // Fix the clock after the morning collection, independent of the test runner time.
  const realNow = Date.now;
  const stamp = '2026-10-02T09:00:00.000Z';
  const snapshot = cache.snapshot!;
  snapshot.standing.fetchedAt = stamp;
  for (const roster of Object.values(snapshot.rosters)) roster.fetchedAt = stamp;
  snapshot.history = undefined;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(cache.config.cacheFile, JSON.stringify(snapshot));
  Date.now = () => Date.parse('2026-10-02T10:00:00Z');
  try {
    fail();
    const skipped = await exportPages(cache, output, undefined, { daily: true, scheduled: true });
    assert.equal(skipped.skipped, true);
    assert.equal(skipped.failed, false);
    const failed = await exportPages(cache, output, undefined, { daily: true });
    assert.equal(failed.failed, true);
    assert.equal(failed.fetchedAt, stamp);
    const response = JSON.parse(await readFile(join(output, 'standing.json'), 'utf8'));
    assert.equal(response.meta.schedule, 'daily-montreal');
    assert.equal(response.meta.nextAttemptAt, null);
    assert.match(response.meta.error, /503/);
  } finally { Date.now = realNow; }
});

test('le secours de 6 h retente Marqueur si le relevé précède 5 h', async () => {
  const { cache, output, fail } = await setup();
  await exportPages(cache, output);
  const snapshot = cache.snapshot!;
  const stamp = '2026-10-02T08:59:59.000Z';
  snapshot.standing.fetchedAt = stamp;
  for (const roster of Object.values(snapshot.rosters)) roster.fetchedAt = stamp;
  snapshot.history = undefined;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(cache.config.cacheFile, JSON.stringify(snapshot));
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-10-02T10:00:00Z');
  try {
    fail();
    const result = await exportPages(cache, output, undefined, { daily: true, scheduled: true });
    assert.equal(result.skipped, false);
    assert.equal(result.failed, true);
    assert.equal(result.fetchedAt, stamp);
    assert.match(cache.error!, /503/);
  } finally { Date.now = realNow; }
});
