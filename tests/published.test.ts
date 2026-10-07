import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicationRequired } from '../server/check-published';

const now = Date.parse('2026-10-07T14:00:00Z');
const valid = {
  data: { participants: Array.from({ length: 7 }, (_, i) => ({ id: String(i + 1), points: 10 + i })) },
  meta: { fetchedAt: '2026-10-07T09:17:00Z', error: null },
};
const serve = (value: unknown, status = 200) => (async () => new Response(JSON.stringify(value), { status })) as typeof fetch;

test('publication du matin réussie : aucun nouveau cycle nécessaire', async () => {
  assert.equal(await publicationRequired('https://example.com/standing.json', now, serve(valid)), false);
});
test('publication ancienne, avant 5 h, future, incomplète ou en erreur : reprise nécessaire', async () => {
  for (const stamp of ['2026-10-06T15:31:00Z', '2026-10-07T08:59:59Z', '2026-10-08T09:00:00Z', 'invalide']) {
    assert.equal(await publicationRequired('https://example.com/standing.json', now, serve({ ...valid, meta: { fetchedAt: stamp, error: null } })), true);
  }
  assert.equal(await publicationRequired('https://example.com/standing.json', now, serve({ ...valid, meta: { ...valid.meta, error: '503' } })), true);
  assert.equal(await publicationRequired('https://example.com/standing.json', now, serve({ ...valid, data: null })), true);
  assert.equal(await publicationRequired('https://example.com/standing.json', now, serve({ ...valid, data: { participants: valid.data.participants.slice(1) } })), true);
  assert.equal(await publicationRequired('https://example.com/standing.json', now, serve(null)), true);
});
test('site inaccessible, HTTP 404 ou JSON invalide : la vérification permet la reprise', async () => {
  assert.equal(await publicationRequired('https://example.com/standing.json', now, serve(null, 404)), true);
  assert.equal(await publicationRequired('https://example.com/standing.json', now, (async () => { throw new Error('timeout'); }) as typeof fetch), true);
  assert.equal(await publicationRequired('https://example.com/standing.json', now, (async () => new Response('<html>')) as typeof fetch), true);
});
test('heure d’hiver : le relevé doit avoir été récupéré après 5 h au Québec', async () => {
  const winterNow = Date.parse('2026-12-07T15:00:00Z');
  for (const [stamp, required] of [['2026-12-07T09:59:59Z', true], ['2026-12-07T10:17:00Z', false]] as const) {
    assert.equal(await publicationRequired('https://example.com/standing.json', winterNow, serve({ ...valid, meta: { fetchedAt: stamp, error: null } })), required);
  }
});
