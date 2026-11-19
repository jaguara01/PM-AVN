import { z } from 'zod';
import { isIsoDate } from './dates';

export const STATUSES = ['todo', 'doing', 'review', 'done'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_NAME: Record<Status, string> = { todo: 'To do', doing: 'In progress', review: 'In review', done: 'Done' };

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const UNASSIGNED = 'Unassigned';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: Status;
  owner: string;
  due: string | null;
  start: string | null;
  priority: Priority;
  notes: string;
  meetingId: string | null;
  turn: number | null;
  position: number;
  createdAt: string;
}

const dateOrNull = z.union([z.string().refine(isIsoDate, 'Use a date like 2026-12-01.'), z.literal(''), z.null()]).transform((v) => (v ? v : null));

/** What a person may change on a task. Every field is optional; unknown fields are dropped. */
export const TaskPatch = z.object({
  title: z.string().trim().min(1, 'A task needs a title.').max(300).optional(),
  status: z.enum(STATUSES).optional(),
  owner: z.string().trim().max(100).transform((v) => v || UNASSIGNED).optional(),
  due: dateOrNull.optional(),
  start: dateOrNull.optional(),
  priority: z.enum(PRIORITIES).optional(),
  notes: z.string().max(10000).optional(),
  projectId: z.string().min(1).optional(),
});
export type TaskPatch = z.infer<typeof TaskPatch>;

export const NewTask = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1, 'A task needs a title.').max(300),
  status: z.enum(STATUSES).default('todo'),
  owner: z.string().trim().max(100).default(UNASSIGNED).transform((v) => v || UNASSIGNED),
  due: dateOrNull.default(null),
  start: dateOrNull.default(null),
  priority: z.enum(PRIORITIES).default('medium'),
  notes: z.string().max(10000).default(''),
  meetingId: z.string().nullable().default(null),
  turn: z.number().int().nullable().default(null),
});
export type NewTask = z.input<typeof NewTask>;

export const nextStatus = (s: Status): Status => STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length];

export const isLate = (t: Pick<Task, 'status' | 'due'>, today: string) => t.status !== 'done' && !!t.due && t.due < today;

/**
 * A position between two neighbours, for ordering cards without renumbering the whole lane.
 * Positions are plain numbers; a card dropped between 3 and 4 gets 3.5.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}
