import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { morningCollected } from '../shared/freshness.ts';
import type { ApiResponse, Standing } from '../shared/types.ts';

// Sans dépendances npm : le contrôle précède toute installation ou compilation.
export async function publicationRequired(url: string, now = Date.now(), fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const target = new URL(url);
    target.searchParams.set('check', String(now));
    const response = await fetcher(target, { cache: 'no-cache', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return true;
    const value: ApiResponse<Standing> = await response.json();
    const stamp = value?.meta?.fetchedAt;
    const participants = value?.data?.participants;
    return !(value?.meta?.error === null && typeof stamp === 'string'
      && Date.parse(stamp) <= now + 60_000 && morningCollected(stamp, now)
      && Array.isArray(participants) && participants.length === 7
      && new Set(participants.map(p => p.id)).size === 7
      && participants.every(p => /^\d+$/.test(p.id) && Number.isFinite(p.points)));
  } catch {
    // Une lecture impossible ne doit jamais empêcher une tentative de publication.
    return true;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const required = process.env.GITHUB_EVENT_NAME !== 'schedule'
    || await publicationRequired(process.env.PAGES_STANDING_URL!);
  const message = required ? 'Relevé absent, ancien ou non vérifiable : synchronisation nécessaire.'
    : 'Relevé du jour déjà publié : arrêt sans installation, appel Marqueur ni compilation.';
  console.info(message);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `required=${required}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Vérification du site publié\n${message}\n`);
}
