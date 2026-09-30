export interface Participant {
  id: string; name: string; rank: number; points: number; gap: number;
  games: number; players: number; goalies: number; teams: number; average: number;
  sourceUrl: string;
}
export interface Standing { season: string; participants: Participant[]; sourceUrl: string }
export interface StatColumn { key: string; label: string; description: string }
export interface Selection { name: string; team: string; round: string; status: string; stats: Record<string, number>; points: number }
export interface RosterGroup { name: string; columns: StatColumn[]; entries: Selection[]; total: number; totals?: Record<string, number> }
export interface Roster { participantId: string; name: string; season: string; groups: RosterGroup[]; total: number; games?: number; average?: number; sourceUrl: string }
export interface Daily { date: string; participants: Participant[]; sourceUrl: string }
export interface Cached<T> { data: T; fetchedAt: string }
export interface Snapshot { standing: Cached<Standing>; rosters: Record<string, Cached<Roster>>; daily: Cached<Daily> | null }
export interface SyncMeta { fetchedAt: string | null; stale: boolean; refreshing: boolean; error: string | null; intervalMinutes: number; staleAfterMinutes?: number; source: 'marqueur'; nextAttemptAt: string | null }
export interface ApiResponse<T> { data: T | null; meta: SyncMeta }
