import { addDays, diffDays } from './dates';
import type { Task } from './tasks';

export interface TimelineBar { task: Task; from: number; span: number }
export interface Timeline { start: string; days: string[]; bars: TimelineBar[]; undated: number; todayIndex: number | null }

/**
 * Lays dated tasks out on a day grid. A task runs from its start date (or the day it was created) to its due date.
 * The window covers a few days before today to a few days after the last due date, at most `maxDays` long.
 */
export function buildTimeline(tasks: Task[], today: string, maxDays = 150): Timeline {
  const dated = tasks.filter((t) => t.due);
  const startOf = (t: Task) => {
    const s = t.start ?? t.createdAt ?? t.due!;
    return s > t.due! ? t.due! : s;
  };
  let a = dated.reduce((m, t) => (startOf(t) < m ? startOf(t) : m), addDays(today, -3));
  if (diffDays(a, today) > 28) a = addDays(today, -28);
  let b = addDays(dated.reduce((m, t) => (t.due! > m ? t.due! : m), addDays(today, 21)), 4);
  if (diffDays(a, b) > maxDays) b = addDays(a, maxDays);
  const n = diffDays(a, b) + 1;
  const clamp = (d: string) => Math.max(0, Math.min(n - 1, diffDays(a, d)));
  const bars = dated
    .sort((x, y) => (startOf(x) < startOf(y) ? -1 : startOf(x) > startOf(y) ? 1 : x.due! < y.due! ? -1 : 1))
    .map((task) => ({ task, from: clamp(startOf(task)), span: clamp(task.due!) - clamp(startOf(task)) + 1 }));
  const ti = diffDays(a, today);
  return { start: a, days: Array.from({ length: n }, (_, i) => addDays(a, i)), bars, undated: tasks.length - dated.length, todayIndex: ti >= 0 && ti < n ? ti : null };
}

export type SortKey = 'status' | 'title' | 'owner' | 'due' | 'priority';
const STATUS_ORDER = ['todo', 'doing', 'review', 'done'];
const PRIORITY_ORDER = ['high', 'medium', 'low'];

/** Sorts a copy of the list; tasks without a due date go last when sorting by date. */
export function sortTasks(tasks: Task[], key: SortKey, dir: 1 | -1): Task[] {
  const v = (t: Task): string | number =>
    key === 'status' ? STATUS_ORDER.indexOf(t.status) : key === 'priority' ? PRIORITY_ORDER.indexOf(t.priority) : key === 'due' ? (t.due ?? '9999-99-99') : t[key].toLowerCase();
  return [...tasks].sort((x, y) => (v(x) < v(y) ? -1 : v(x) > v(y) ? 1 : 0) * dir);
}
