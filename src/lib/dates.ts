/** Calendar dates as ISO strings (YYYY-MM-DD), so server and browser agree and nothing shifts with time zones. */

const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Europe/Brussels';
const pad = (n: number) => String(n).padStart(2, '0');

export const isIsoDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Today in the team's time zone. */
export function todayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

export function diffDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000);
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (iso: string) => toDate(iso).getUTCDay();
export const dayOfMonth = (iso: string) => toDate(iso).getUTCDate();

export function fmtDay(iso: string): string {
  return toDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
export function fmtWeekday(iso: string, style: 'short' | 'long' = 'short'): string {
  return toDate(iso).toLocaleDateString('en-GB', { weekday: style, timeZone: 'UTC' });
}
export function fmtMonth(iso: string): string {
  return toDate(iso).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
}
export function fmtLong(iso: string): string {
  return toDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** "Today", "Tomorrow", "Yesterday" or a short date. */
export function dueLabel(iso: string | null, today: string): string {
  if (!iso) return '';
  const d = diffDays(today, iso);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : fmtDay(iso);
}
