import type { SyncMeta } from './types';
export function currentMeta(meta: SyncMeta, now = Date.now()): SyncMeta {
  return { ...meta, stale: meta.stale || !meta.fetchedAt || now - Date.parse(meta.fetchedAt) > (meta.staleAfterMinutes ?? 45) * 60_000 };
}
