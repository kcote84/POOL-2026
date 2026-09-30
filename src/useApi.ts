import { useEffect, useState } from 'react';
import type { ApiResponse } from '../shared/types';
import { apiHref, currentMeta } from './platform';
export function useApi<T>(endpoint: string) {
  const [response, setResponse] = useState<ApiResponse<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { setResponse(null); setLoading(true); setNetworkError(null); }, [endpoint]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function get() {
      try {
        const res = await fetch(apiHref(endpoint), { cache: 'no-cache', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!res.ok) throw new Error(res.status === 404 ? 'Cette formation est introuvable.' : 'Le serveur du royaume est indisponible.');
        const json = await res.json() as ApiResponse<T>;
        if (!json.meta) throw new Error('Réponse du serveur non reconnue.');
        json.meta = currentMeta(json.meta);
        if (!stopped) { setResponse(json); setNetworkError(null); }
        if (!stopped) timer = setTimeout(get, json.meta.refreshing ? 2000 : 60_000);
      } catch (error) {
        if (!stopped) { setNetworkError(error instanceof Error ? error.message : 'Connexion impossible.'); timer = setTimeout(get, 30_000); }
      } finally { if (!stopped) setLoading(false); }
    }
    void get();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [endpoint, reload]);
  return { response, loading, networkError, retry: () => setReload(v => v + 1) };
}
