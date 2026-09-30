import type { Cached, Standing, StandingHistory, HistoryRecord } from './types';

export function observedDate(stamp: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(stamp));
}
function record(standing: Cached<Standing>): HistoryRecord {
  return { date: observedDate(standing.fetchedAt), observedAt: standing.fetchedAt, participants: standing.data.participants.map(({ id, name, rank, points, games, average }) => ({ id, name, rank, points, games, average })) };
}
export function validHistory(history: StandingHistory, standing: Cached<Standing>): boolean {
  try {
    if (!history || history.season !== standing.data.season || !Array.isArray(history.records) || !history.records.length || history.records.length > 400) return false;
    let previous = '';
    for (const r of history.records) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || r.date <= previous || !Number.isFinite(Date.parse(r.observedAt)) || Date.parse(r.observedAt) > Date.parse(standing.fetchedAt) || observedDate(r.observedAt) !== r.date) return false;
      previous = r.date;
      if (!Array.isArray(r.participants) || r.participants.length !== 7 || new Set(r.participants.map(p => p.id)).size !== 7) return false;
      for (const [index, p] of r.participants.entries()) {
        if (!standing.data.participants.some(current => current.id === p.id && current.name === p.name) || p.rank !== index + 1 || ![p.points, p.games, p.average].every(n => typeof n === 'number' && Number.isFinite(n)) || !Number.isInteger(p.games) || p.games < 0 || (index > 0 && p.points > r.participants[index - 1].points)) return false;
      }
    }
    return true;
  } catch { return false; }
}
export function updateHistory(previous: StandingHistory | undefined, standing: Cached<Standing>, previousStanding?: Cached<Standing>): StandingHistory {
  let history: StandingHistory = previous && validHistory(previous, standing) ? structuredClone(previous) : { season: standing.data.season, records: [] };
  if (!history.records.length && previousStanding?.data.season === standing.data.season) {
    const seed = { season: standing.data.season, records: [record(previousStanding)] };
    if (validHistory(seed, standing)) history = seed;
  }
  const latest = record(standing);
  const index = history.records.findIndex(r => r.date === latest.date);
  if (index === -1) history.records.push(latest); else history.records[index] = latest;
  history.records.sort((a, b) => a.date.localeCompare(b.date));
  history.records = history.records.slice(-400);
  return history;
}