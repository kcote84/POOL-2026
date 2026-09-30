import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { PoolCache } from './cache';

function setting(key: string, fallback: number, minimum: number) {
  const value = Number(process.env[key] ?? fallback);
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${key} doit être un nombre >= ${minimum}.`);
  return value;
}
const cache = new PoolCache({
  intervalMs: setting('SYNC_INTERVAL_MINUTES', 15, 5) * 60_000,
  staleMs: setting('STALE_AFTER_MINUTES', 45, 5) * 60_000,
  timeoutMs: setting('REQUEST_TIMEOUT_SECONDS', 15, 1) * 1000,
  cacheFile: resolve(process.env.CACHE_FILE ?? '.cache/marqueur.json'),
});
await cache.load();
const app = express();
app.disable('x-powered-by');
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  void cache.refresh();
  next();
});
app.get('/api/standing', (_req, res) => res.json(cache.response(cache.snapshot?.standing)));
app.get('/api/rosters/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) { res.status(404).json({ error: 'Formation introuvable.' }); return; }
  const roster = cache.snapshot?.rosters[req.params.id];
  if (cache.snapshot && !roster) { res.status(404).json({ error: 'Formation introuvable.' }); return; }
  res.json(cache.response(roster));
});
app.get('/api/daily', (_req, res) => res.json(cache.response(cache.snapshot?.daily, cache.dailyError ?? cache.error ?? (cache.snapshot?.daily ? null : 'La date du tableau quotidien de Marqueur ne peut pas être confirmée.'))));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue.' }));
const dist = resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
}
const server = app.listen(setting('PORT', 3001, 1), '0.0.0.0', () => console.info('Le royaume vous attend : http://localhost:3001 (production) / http://localhost:5173 (développement)'));
void cache.refresh();
const timer = setInterval(() => { void cache.refresh(); }, 60_000);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { clearInterval(timer); server.close(() => process.exit(0)); });
