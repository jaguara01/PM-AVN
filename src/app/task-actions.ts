'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { getDb } from '@/lib/db/client';
import { createTask, deleteProject, deleteTask, moveTask, updateProject, updateTask } from '@/lib/db/repo';
import { STATUSES, type NewTask, type Status, type TaskPatch } from '@/lib/tasks';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (e: unknown): ActionResult => ({ ok: false, error: e instanceof ZodError ? e.issues.map((i) => i.message).join(' ') : 'Saving failed. Try again.' });
const done = (id?: string): ActionResult => {
  revalidatePath('/', 'layout');
  return { ok: true, id };
};

export async function createTaskAction(input: NewTask): Promise<ActionResult> {
  try {
    return done(await createTask(await getDb(), input));
  } catch (e) {
    return fail(e);
  }
}

export async function updateTaskAction(id: string, patch: TaskPatch): Promise<ActionResult> {
  try {
    await updateTask(await getDb(), id, patch);
    return done(id);
  } catch (e) {
    return fail(e);
  }
}

export async function moveTaskAction(id: string, status: Status, beforeId: string | null): Promise<ActionResult> {
  if (!STATUSES.includes(status)) return { ok: false, error: 'Unknown status.' };
  await moveTask(await getDb(), id, status, beforeId);
  return done(id);
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  await deleteTask(await getDb(), id);
  return done();
}

export async function updateProjectAction(id: string, patch: { name?: string; description?: string }): Promise<ActionResult> {
  if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: 'A project needs a name.' };
  await updateProject(await getDb(), id, patch);
  return done(id);
}

export async function deleteProjectAction(id: string): Promise<void> {
  await deleteProject(await getDb(), id);
  revalidatePath('/', 'layout');
  redirect('/');
}
