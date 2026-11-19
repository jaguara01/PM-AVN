'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { addMeetingAction, deleteDocument, deleteMeeting, deleteMeetingAction as deleteActionRow, updateMeeting, updateMeetingAction, type BoardNode } from '@/lib/db/repo';
import { isIsoDate } from '@/lib/dates';
import { llmFromEnv } from '@/lib/llm';
import type { MeetingTemplate, ProjectTemplate } from '@/lib/meetings/prompts';
import { analyzeMeeting, askAboutMeeting, importMeeting, runMeetingCommand, sendActionToBoard, sendAllToBoard, writeDocument, UserError } from '@/lib/services/meetings';

export type Result<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };

const NO_MODEL = 'No text model is configured. Add one in .env.local (see "Choosing the AI services" in the README).';

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const value = await fn();
    revalidatePath('/', 'layout');
    return { ok: true, value };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: /fetch failed|ECONN|ENOTFOUND|\b(401|403|404|429|500|503)\b/.test(msg) ? `The text model did not answer: ${msg.slice(0, 200)}` : 'Something went wrong. Try again.' };
  }
}

function needModel() {
  const llm = llmFromEnv();
  if (!llm) throw new UserError(NO_MODEL);
  return llm;
}

/** Form action for the import page. Redirects to the new meeting. */
export async function importMeetingAction(_prev: Result | null, form: FormData): Promise<Result> {
  const date = String(form.get('heldOn') ?? '');
  let id = '';
  const r = await run(async () => {
    const out = await importMeeting(await getDb(), {
      text: String(form.get('text') ?? ''),
      title: String(form.get('title') ?? ''),
      projectId: String(form.get('projectId') ?? '') || null,
      heldOn: isIsoDate(date) ? date : undefined,
      domains: String(form.get('domains') ?? ''),
      redact: form.get('redact') === 'on',
    }, llmFromEnv());
    id = out.id;
    return out.modelError;
  });
  if (!r.ok) return r;
  redirect(`/meetings/${id}${r.value ? '?model=failed' : ''}`);
}

export async function updateMeetingDetails(id: string, patch: { title?: string; projectId?: string | null; heldOn?: string; redact?: boolean }) {
  return run(async () => {
    if (patch.title !== undefined && !patch.title.trim()) throw new UserError('A meeting needs a title.');
    if (patch.heldOn !== undefined && !isIsoDate(patch.heldOn)) throw new UserError('Use a date like 2026-12-01.');
    await updateMeeting(await getDb(), id, { ...patch, title: patch.title?.trim(), titleEdited: patch.title !== undefined ? true : undefined });
  });
}

export async function analyzeMeetingAction(id: string) {
  return run(async () => analyzeMeeting(await getDb(), id, needModel()));
}

export async function removeMeeting(id: string): Promise<void> {
  await deleteMeeting(await getDb(), id);
  revalidatePath('/', 'layout');
  redirect('/meetings');
}

export async function editActionItem(id: string, patch: { task?: string; owner?: string; due?: string | null; priority?: string }) {
  return run(async () => {
    if (patch.due && !isIsoDate(patch.due)) throw new UserError('Use a date like 2026-12-01.');
    if (patch.priority && !['high', 'medium', 'low'].includes(patch.priority)) throw new UserError('Unknown priority.');
    await updateMeetingAction(await getDb(), id, patch);
  });
}
export async function addActionItem(meetingId: string) {
  return run(async () => { await addMeetingAction(await getDb(), meetingId, { task: 'New action item' }); });
}
export async function dismissActionItem(id: string) {
  return run(async () => deleteActionRow(await getDb(), id));
}
export async function sendActionItem(id: string) {
  return run(async () => sendActionToBoard(await getDb(), id));
}
export async function sendAllActionItems(meetingId: string) {
  return run(async () => sendAllToBoard(await getDb(), meetingId));
}

export async function saveWhiteboard(meetingId: string, board: BoardNode[] | null) {
  return run(async () => updateMeeting(await getDb(), meetingId, { board }));
}

export async function askAction(meetingId: string, question: string, scope: 'meeting' | 'project') {
  return run(async () => askAboutMeeting(await getDb(), meetingId, question, scope, needModel()));
}
export async function clearChat(meetingId: string) {
  return run(async () => updateMeeting(await getDb(), meetingId, { chat: [] }));
}
export async function runCommandAction(meetingId: string, index: number) {
  return run(async () => runMeetingCommand(await getDb(), meetingId, index, needModel()));
}

export async function writeDocumentAction(target: { meetingId: string; template: MeetingTemplate } | { projectId: string; template: ProjectTemplate }, extra: string) {
  return run(async () => writeDocument(await getDb(), target, extra, needModel()));
}
export async function deleteDocumentAction(id: string) {
  return run(async () => deleteDocument(await getDb(), id));
}
