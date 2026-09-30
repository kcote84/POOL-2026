import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ApiResponse, Snapshot, Standing, Roster, Daily } from '../shared/types';
import { DAILY_URL, STANDING_URL, parseDaily, parseRoster, parseStanding, safeSource } from './parser';

export interface Config { intervalMs: number; staleMs: number; timeoutMs: number; cacheFile: string }
export type FetchHtml = (url: string) => Promise<string>;
export function httpFetcher(timeoutMs: number): FetchHtml {
  return async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', headers: { 'User-Agent': 'Keven2026-Pool/1.0 (private pool results reader)', Accept: 'text/html' } });
    if (!response.ok) throw new Error(`Marqueur répond HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Marqueur ne renvoie pas une page HTML.');
    const html = await response.text();
    if (html.length < 100 || html.length > 2_000_000) throw new Error('Page Marqueur vide ou de taille inattendue.');
    return html;
  };
}
export function validateSnapshot(value: unknown): value is Snapshot {
  try {
    const s = value as Snapshot;
    const stamp = (v: string) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && Date.parse(v) <= Date.now() + 60_000;
    const finite = (v: number) => typeof v === 'number' && Number.isFinite(v);
    if (!s || !s.standing || !stamp(s.standing.fetchedAt) || !/^\d{4}-\d{4}$/.test(s.standing.data.season) || s.standing.data.sourceUrl !== STANDING_URL) return false;
    const ps = s.standing.data.participants;
    if (!Array.isArray(ps) || ps.length !== 7 || new Set(ps.map(p => p.id)).size !== 7) return false;
    for (const [index, p] of ps.entries()) {
      if (!p.name || !/^\d+$/.test(p.id) || p.rank !== index + 1 || ![p.points, p.gap, p.games, p.players, p.goalies, p.teams, p.average].every(finite) || p.points !== p.players + p.goalies + p.teams || p.gap !== ps[0].points - p.points || (index && p.points > ps[index - 1].points)) return false;
      if (new URL(safeSource(p.sourceUrl)).searchParams.get('no')?.split('|')[0] !== p.id) return false;
      const cached = s.rosters[p.id], r = cached?.data;
      if (!cached || !stamp(cached.fetchedAt) || !r || r.participantId !== p.id || r.name !== p.name || r.season !== s.standing.data.season || r.total !== p.points || r.sourceUrl !== p.sourceUrl || !r.groups.length || r.groups.reduce((n, g) => n + g.total, 0) !== r.total) return false;
      for (const g of r.groups) {
        if (!g.name || !finite(g.total) || !g.entries.length || !g.columns.length) return false;
        for (const e of g.entries) if (!e.name || !finite(e.points) || !Object.values(e.stats).every(finite)) return false;
      }
    }
    if (s.daily !== null && (!stamp(s.daily.fetchedAt) || !/^\d{1,2} [A-ZÀ-Ü]+ \d{4}$/.test(s.daily.data.date) || s.daily.data.sourceUrl !== DAILY_URL || s.daily.data.participants.length !== 7 || s.daily.data.participants.some(p => !finite(p.points) || !ps.some(q => q.id === p.id)))) return false;
    return true;
  } catch { return false; }
}
export class PoolCache {
  snapshot: Snapshot | null = null;
  error: string | null = null;
  dailyError: string | null = null;
  private pending: Promise<void> | null = null;
  private lastAttempt = 0;
  constructor(readonly config: Config, private fetchHtml: FetchHtml = httpFetcher(config.timeoutMs)) {}
  async load() {
    try {
      const value: unknown = JSON.parse(await readFile(this.config.cacheFile, 'utf8'));
      if (!validateSnapshot(value)) throw new Error('Cache invalide.');
      this.snapshot = value;
      this.lastAttempt = Date.parse(value.standing.fetchedAt);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.error = 'Le cache enregistré est illisible. Une nouvelle récupération est nécessaire.';
    }
  }
  get refreshing() { return this.pending !== null; }
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    if (Date.now() - this.lastAttempt < this.config.intervalMs) return Promise.resolve();
    this.lastAttempt = Date.now();
    this.pending = this.collect().finally(() => { this.pending = null; });
    return this.pending;
  }
  private async collect() {
    try {
      const standing = parseStanding(await this.fetchHtml(STANDING_URL));
      const rosters: Snapshot['rosters'] = {};
      for (const participant of standing.participants) {
        const roster = parseRoster(await this.fetchHtml(participant.sourceUrl), participant, standing.season);
        rosters[participant.id] = { data: roster, fetchedAt: new Date().toISOString() };
      }
      let daily: Snapshot['daily'] = this.snapshot?.standing.data.season === standing.season ? this.snapshot.daily : null;
      try {
        const data = parseDaily(await this.fetchHtml(DAILY_URL));
        if (data.participants.some(p => !standing.participants.some(q => p.id === q.id && p.name === q.name))) throw new Error('Participants du quotidien incohérents.');
        daily = { data, fetchedAt: new Date().toISOString() };
        this.dailyError = null;
      } catch (error) { this.dailyError = error instanceof Error ? error.message : 'Résultats quotidiens indisponibles.'; }
      const candidate: Snapshot = { standing: { data: standing, fetchedAt: new Date().toISOString() }, rosters, daily };
      if (!validateSnapshot(candidate)) throw new Error('Les résultats récupérés ne passent pas les contrôles de cohérence.');
      await mkdir(dirname(this.config.cacheFile), { recursive: true });
      const tempFile = `${this.config.cacheFile}.tmp`;
      await writeFile(tempFile, JSON.stringify(candidate), 'utf8');
      await rename(tempFile, this.config.cacheFile);
      this.snapshot = candidate;
      this.error = null;
      console.info(`[Marqueur] Sept formations validées le ${candidate.standing.fetchedAt}`);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Récupération impossible.';
      console.warn(`[Marqueur] ${this.error} Dernier résultat valide conservé.`);
    }
  }
  response<T extends Standing | Roster | Daily>(cached: { data: T; fetchedAt: string } | null | undefined, error = this.error): ApiResponse<T> {
    return { data: cached?.data ?? null, meta: {
      fetchedAt: cached?.fetchedAt ?? null,
      stale: !cached || Date.now() - Date.parse(cached.fetchedAt) > this.config.staleMs,
      refreshing: this.refreshing, error, intervalMinutes: this.config.intervalMs / 60_000,
      source: 'marqueur', nextAttemptAt: this.lastAttempt ? new Date(this.lastAttempt + this.config.intervalMs).toISOString() : null,
    } };
  }
}
