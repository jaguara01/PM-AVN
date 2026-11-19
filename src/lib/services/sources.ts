import type { Db } from '@/lib/db/client';
import type { Task } from '@/lib/tasks';
import type { TaskSource } from '@/components/task-panel';

/** For tasks created from a meeting: the meeting and the line they came from. Filled in once meetings exist. */
export async function taskSources(_db: Db, _tasks: Task[]): Promise<Record<string, TaskSource>> {
  return {};
}
