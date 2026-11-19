import type { Db } from '@/lib/db/client';
import { meetingOrigins } from '@/lib/db/repo';
import type { Task } from '@/lib/tasks';
import type { TaskSource } from '@/components/task-panel';

/** For tasks created from a meeting: the meeting and the line they came from, keyed by task id. */
export async function taskSources(db: Db, tasks: Task[]): Promise<Record<string, TaskSource>> {
  const ids = [...new Set(tasks.map((t) => t.meetingId).filter((x): x is string => !!x))];
  const origins = await meetingOrigins(db, ids);
  const out: Record<string, TaskSource> = {};
  for (const t of tasks) {
    const o = t.meetingId ? origins.get(t.meetingId) : undefined;
    if (!o) continue;
    const turn = t.turn !== null ? o.turns[t.turn] : undefined;
    out[t.id] = { meetingId: t.meetingId!, meetingTitle: o.title, meetingDate: o.heldOn, turn: t.turn, speaker: turn?.spk, text: turn?.text };
  }
  return out;
}
