import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PoolCache, validateSnapshot } from './cache';

export async function exportPages(cache: PoolCache, outputDir: string, seedUrl?: string) {
  await cache.load();
  // Le site déjà publié sert de secours si le cache du runner GitHub a été évincé.
  if (!cache.snapshot && seedUrl) {
    try {
      const res = await fetch(seedUrl, { signal: AbortSignal.timeout(15_000), cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const value: unknown = await res.json();
      if (!validateSnapshot(value)) throw new Error('Instantané publié invalide.');
      await mkdir(dirname(cache.config.cacheFile), { recursive: true });
      await writeFile(cache.config.cacheFile, JSON.stringify(value));
      await cache.load();
    } catch { console.info('Pas d’instantané publié réutilisable. Tentative de récupération Marqueur.'); }
  }
  await cache.refresh();
  await mkdir(outputDir, { recursive: true });
  const snapshot = cache.snapshot;
  const files: Record<string, unknown> = {
    'standing.json': cache.response(snapshot?.standing),
    'daily.json': cache.response(snapshot?.daily, cache.dailyError ?? cache.error ?? (snapshot?.daily ? null : 'La date du tableau quotidien de Marqueur ne peut pas être confirmée.')),
    'snapshot.json': snapshot,
  };
  if (snapshot) for (const [id, roster] of Object.entries(snapshot.rosters)) files[`roster-${id}.json`] = cache.response(roster);
  for (const [name, data] of Object.entries(files)) await writeFile(resolve(outputDir, name), JSON.stringify(data), 'utf8');
  if (cache.error) console.warn(`Publication du dernier résultat disponible : ${cache.error}`);
  console.info(snapshot ? `Instantané réel : ${snapshot.standing.fetchedAt}` : 'Aucun résultat valide : publication de l’état indisponible.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  function minutes(key: string, fallback: number) {
    const n = Number(process.env[key] ?? fallback);
    if (!Number.isFinite(n) || n < 5) throw new Error(`${key} doit être >= 5.`);
    return n * 60_000;
  }
  const cache = new PoolCache({
    cacheFile: resolve(process.env.CACHE_FILE ?? '.cache/marqueur.json'),
    intervalMs: minutes('SYNC_INTERVAL_MINUTES', 15), staleMs: minutes('STALE_AFTER_MINUTES', 45), timeoutMs: 15_000,
  });
  await exportPages(cache, resolve('public/data'), process.env.PAGES_SEED_URL);
}
