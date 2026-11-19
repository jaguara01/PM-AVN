import type { Db } from '@/lib/db/client';
import {
  createDocument, createMeeting, createTask, getMeeting, getMeetingAction, getProject, linkActionToTask, listMeetingActions, listMeetings, listTasks,
  saveAnalysis, setMeetingAnalysis, updateMeeting, type BoardNode, type Meeting,
} from '@/lib/db/repo';
import { todayIso } from '@/lib/dates';
import { analyzeWithModel, offlineAnalysis, transcriptText, type Analysis, type ProposedAction } from '@/lib/meetings/analysis';
import { MEETING_TEMPLATES, PROJECT_TEMPLATES, askPrompt, commandPrompt, documentPrompt, type MeetingTemplate, type ProjectTemplate } from '@/lib/meetings/prompts';
import { STATUS_NAME, isLate } from '@/lib/tasks';
import { externalDomains, parseDue, parseTranscript } from '@/lib/transcript';
import type { Llm } from '@/lib/llm';

export class UserError extends Error {}

const withDates = (actions: ProposedAction[], heldOn: string) =>
  actions.map((a) => ({ ...a, owner: a.owner === 'Team' ? 'Unassigned' : a.owner, dueDate: parseDue(a.due, heldOn) || null }));

export interface ImportOptions {
  text: string;
  title?: string;
  projectId?: string | null;
  heldOn?: string;
  domains?: string;
  redact?: boolean;
  wake?: string;
}

/** Parses a transcript, writes quick offline notes, stores the meeting, then asks the model for proper notes when one is configured. */
export async function importMeeting(db: Db, o: ImportOptions, llm: Llm | null): Promise<{ id: string; modelError?: string }> {
  const { turns, format } = parseTranscript(o.text ?? '');
  if (!turns.length) throw new UserError('Paste or drop a transcript first.');
  const wake = o.wake?.trim() || 'Claude';
  const heldOn = o.heldOn || todayIso();
  const { analysis, actions } = offlineAnalysis(turns, wake);
  const title = o.title?.trim();
  const id = await createMeeting(db, {
    projectId: o.projectId || null,
    title: title || 'Untitled meeting',
    titleEdited: !!title,
    heldOn,
    format,
    wake,
    redact: o.redact !== false,
    domains: o.domains ?? '',
    external: externalDomains(turns, [], o.domains ?? ''),
    speakers: [...new Set(turns.map((t) => t.spk))],
    turns,
    analysis,
  });
  await setMeetingAnalysis(db, id, analysis, withDates(actions, heldOn));
  if (!llm) return { id };
  try {
    await analyzeMeeting(db, id, llm);
    return { id };
  } catch (e) {
    return { id, modelError: e instanceof Error ? e.message : String(e) };
  }
}

/** Rewrites the meeting notes with the model. Action items already on a board are kept. */
export async function analyzeMeeting(db: Db, id: string, llm: Llm): Promise<void> {
  const m = await getMeeting(db, id);
  if (!m) throw new UserError('This meeting no longer exists.');
  const { analysis, actions } = await analyzeWithModel(m.turns, { wake: m.wake, redact: m.redact, complete: llm.complete, writtenBy: llm.name });
  await setMeetingAnalysis(db, id, analysis, withDates(actions, m.heldOn ?? todayIso()));
}

/** Creates a board task from an action item and links the two. */
export async function sendActionToBoard(db: Db, actionId: string): Promise<string> {
  const a = await getMeetingAction(db, actionId);
  if (!a) throw new UserError('This action item no longer exists.');
  if (a.taskId) return a.taskId;
  const m = await getMeeting(db, a.meetingId);
  if (!m?.projectId || !(await getProject(db, m.projectId))) throw new UserError('Choose a project for this meeting first.');
  const taskId = await createTask(db, {
    projectId: m.projectId,
    title: a.task,
    owner: a.owner,
    due: a.due,
    priority: a.priority,
    meetingId: m.id,
    turn: a.turn,
    notes: a.dueSaid && !a.due ? `Due as said in the meeting: ${a.dueSaid}` : '',
  });
  await linkActionToTask(db, a.id, taskId);
  return taskId;
}

export async function sendAllToBoard(db: Db, meetingId: string): Promise<number> {
  const open = (await listMeetingActions(db, meetingId)).filter((a) => !a.taskId);
  for (const a of open) await sendActionToBoard(db, a.id);
  return open.length;
}

/** Answers a question about one meeting, or about every meeting in its project, and keeps the conversation. */
export async function askAboutMeeting(db: Db, id: string, question: string, scope: 'meeting' | 'project', llm: Llm): Promise<string> {
  const m = await getMeeting(db, id);
  if (!m) throw new UserError('This meeting no longer exists.');
  if (!question.trim()) throw new UserError('Type a question first.');
  let others = '';
  if (scope === 'project') {
    const list = (await listMeetings(db, m.projectId ? { projectId: m.projectId } : {})).filter((x) => x.id !== id).slice(0, 20);
    others = list.map((x) => `## ${x.title} (${x.heldOn ?? 'no date'})\n${x.summary}`).join('\n\n');
  }
  const answer = await llm.complete(askPrompt(question, m.title, transcriptText(m.turns, { redact: m.redact }), others, m.chat));
  await updateMeeting(db, id, { chat: [...m.chat, { role: 'user' as const, content: question }, { role: 'assistant' as const, content: answer }].slice(-40) });
  return answer;
}

/** Carries out a request someone made to the assistant during the call, using only what had been said up to that point. */
export async function runMeetingCommand(db: Db, id: string, index: number, llm: Llm): Promise<string> {
  const m = await getMeeting(db, id);
  const c = m?.analysis.commands[index];
  if (!m || !c) throw new UserError('This request no longer exists.');
  const result = await llm.complete(commandPrompt(m.wake, c.speaker, c.turn, c.request, transcriptText(m.turns, { redact: m.redact, upto: c.turn })));
  const analysis: Analysis = { ...m.analysis, commands: m.analysis.commands.map((x, i) => (i === index ? { ...x, result } : x)) };
  await saveAnalysis(db, id, analysis);
  return result;
}

async function projectMaterial(db: Db, projectId: string): Promise<string> {
  const p = await getProject(db, projectId);
  if (!p) throw new UserError('This project no longer exists.');
  const today = todayIso();
  const tasks = await listTasks(db, projectId);
  const meetings = (await listMeetings(db, { projectId })).slice(0, 15);
  const fullMeetings = await Promise.all(meetings.map((x) => getMeeting(db, x.id)));
  return `PROJECT: ${p.name}\n${p.description ? `About: ${p.description}\n` : ''}TODAY: ${today}

TASKS:
${tasks.map((t) => `- [${STATUS_NAME[t.status]}] ${t.title} | owner: ${t.owner} | due: ${t.due ?? 'none'}${isLate(t, today) ? ' (LATE)' : ''} | ${t.priority}`).join('\n') || '(none)'}

MEETINGS:
${fullMeetings.filter(Boolean).map((m) => `- ${m!.title} (${m!.heldOn ?? 'no date'}): ${m!.analysis.summary}
  Decisions: ${m!.analysis.decisions.map((d) => d.text).join(' | ') || 'none'}
  Open questions: ${m!.analysis.questions.map((q) => q.text).join(' | ') || 'none'}
  Risks: ${m!.analysis.risks.map((r) => r.text).join(' | ') || 'none'}`).join('\n') || '(none)'}`;
}

/** Writes a document from a meeting or from a project and stores it. Returns the document's id. */
export async function writeDocument(
  db: Db,
  target: { meetingId: string; template: MeetingTemplate } | { projectId: string; template: ProjectTemplate },
  extra: string,
  llm: Llm,
): Promise<string> {
  if (target.template === 'custom' && !extra.trim()) throw new UserError('Describe the document you want.');
  if ('meetingId' in target) {
    const m = await getMeeting(db, target.meetingId);
    if (!m) throw new UserError('This meeting no longer exists.');
    const [name, instructions] = MEETING_TEMPLATES[target.template];
    const actions = await listMeetingActions(db, m.id);
    const material = `MEETING: ${m.title} (${m.heldOn ?? 'no date'})
ACTION ITEMS:
${actions.map((a) => `- ${a.task} | owner: ${a.owner} | due: ${a.due ?? a.dueSaid ?? 'n/a'} [#${a.turn}]`).join('\n') || '(none)'}

TRANSCRIPT:
${transcriptText(m.turns, { redact: m.redact })}`;
    const body = await llm.complete(documentPrompt(name, instructions, extra, material, true));
    return createDocument(db, { meetingId: m.id, projectId: m.projectId, name, template: target.template, body, writtenBy: llm.name });
  }
  const [name, instructions] = PROJECT_TEMPLATES[target.template];
  const body = await llm.complete(documentPrompt(name, instructions, extra, await projectMaterial(db, target.projectId), false));
  return createDocument(db, { projectId: target.projectId, name, template: target.template, body, writtenBy: llm.name });
}

/** The whiteboard: one column per topic, with that topic's decisions, actions, questions and risks underneath. */
export async function layoutWhiteboard(db: Db, m: Meeting): Promise<BoardNode[]> {
  const a = m.analysis;
  const topics = a.topics.length ? a.topics : [{ title: 'Meeting', start: 0, summary: '' }];
  const actions = await listMeetingActions(db, m.id);
  const items: Omit<BoardNode, 'x' | 'y'>[] = [];
  const add = (kind: BoardNode['kind'], text: string, turn: number, owner?: string) => items.push({ id: `${kind}-${items.length}`, kind, text, turn, owner });
  a.decisions.forEach((d) => add('decision', d.text, d.turn));
  actions.forEach((x) => add('action', x.task, x.turn, x.owner));
  a.questions.forEach((q) => add('question', q.text, q.turn));
  a.risks.forEach((r) => add('risk', r.text, r.turn));
  const W = 240;
  const nodes: BoardNode[] = [];
  topics.forEach((t, c) => {
    const end = topics[c + 1]?.start ?? Infinity;
    const lo = c === 0 ? -1 : t.start;
    nodes.push({ id: `topic-${c}`, kind: 'topic', text: t.title, turn: t.start, x: 24 + c * (W + 24), y: 24 });
    items.filter((it) => (it.turn ?? 0) >= lo && (it.turn ?? 0) < end).forEach((it, r) => nodes.push({ ...it, x: 24 + c * (W + 24), y: 110 + r * 118 }));
  });
  return nodes;
}

