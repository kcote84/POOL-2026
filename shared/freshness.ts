import type { SyncMeta } from './types';

export function montrealClock(now: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
export function morningCollected(fetchedAt: string | null, now = Date.now()) {
  if (!fetchedAt || !Number.isFinite(Date.parse(fetchedAt))) return false;
  const fetched = montrealClock(Date.parse(fetchedAt));
  return fetched.date === montrealClock(now).date && fetched.minutes >= 300;
}
export function dailyStale(fetchedAt: string | null, now = Date.now()) {
  if (!fetchedAt || !Number.isFinite(Date.parse(fetchedAt))) return true;
  const today = montrealClock(now);
  // Délai de grâce jusqu’à 7 h, une heure après le secours de 6 h.
  const expected = today.minutes >= 420 ? today.date : new Date(Date.parse(`${today.date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const fetched = montrealClock(Date.parse(fetchedAt));
  return fetched.date < expected || (fetched.date === expected && fetched.minutes < 300);
}
export function currentMeta(meta: SyncMeta, now = Date.now()): SyncMeta {
  return { ...meta, stale: meta.schedule === 'daily-montreal' ? dailyStale(meta.fetchedAt, now) : meta.stale || !meta.fetchedAt || now - Date.parse(meta.fetchedAt) > (meta.staleAfterMinutes ?? 45) * 60_000 };
}
