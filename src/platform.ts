export { currentMeta } from '../shared/freshness';

export const staticPages = import.meta.env.MODE === 'pages';
export const baseUrl = import.meta.env.BASE_URL;
export const currentPath = () => staticPages ? (window.location.hash.slice(1) || '/') : window.location.pathname;
export const pageHref = (path: string) => staticPages ? `${baseUrl}#${path}` : path;
export function apiHref(endpoint: string) {
  if (!staticPages) return endpoint;
  if (endpoint === '/api/standing') return `${baseUrl}data/standing.json`;
  if (endpoint === '/api/daily') return `${baseUrl}data/daily.json`;
  const id = endpoint.match(/^\/api\/rosters\/(\d+)$/)?.[1];
  if (!id) throw new Error('Formation introuvable.');
  return `${baseUrl}data/roster-${id}.json`;
}
