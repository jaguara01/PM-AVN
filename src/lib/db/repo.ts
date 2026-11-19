import { randomUUID } from 'node:crypto';
import type { Db } from './client';
import type { ProjectProfile, ProjectSource, StoredProfile } from '@/lib/similarity';
import { NewTask, TaskPatch, positionBetween, type Status, type Task } from '@/lib/tasks';
import type { Turn } from '@/lib/transcript';
import type { Analysis, ProposedAction } from '@/lib/meetings/analysis';

export type { Task } from '@/lib/tasks';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: number;
}
const toVector = (v: number[]) => `[${v.join(',')}]`;
const fromVector = (v: unknown): number[] => (typeof v === 'string' ? (JSON.parse(v) as number[]) : (v as number[]));
const newId = () => randomUUID().replace(/-/g, '').slice(0, 12);

export async function listProjects(db: Db): Promise<Project[]> {
  return (await db.query<Project>('SELECT id, name, description, color FROM projects ORDER BY created_at, name')).rows;
}

export async function getProject(db: Db, id: string): Promise<Project | null> {
  return (await db.query<Project>('SELECT id, name, description, color FROM projects WHERE id = $1', [id])).rows[0] ?? null;
}

export async function createProject(db: Db, input: { id?: string; name: string; description?: string; color?: number }): Promise<Project> {
  const id = input.id ?? newId();
  await db.query('INSERT INTO projects (id, name, description, color) VALUES ($1, $2, $3, $4)', [id, input.name, input.description ?? '', input.color ?? 0]);
  return (await getProject(db, id))!;
}

export async function updateProject(db: Db, id: string, patch: { name?: string; description?: string }): Promise<void> {
  if (patch.name !== undefined && patch.name.trim()) await db.query('UPDATE projects SET name = $2 WHERE id = $1', [id, patch.name.trim()]);
  if (patch.description !== undefined) await db.query('UPDATE projects SET description = $2 WHERE id = $1', [id, patch.description.trim()]);
}

/** Deletes the project and its tasks. Meetings stay, without a project. */
export async function deleteProject(db: Db, id: string): Promise<void> {
  await db.query('DELETE FROM projects WHERE id = $1', [id]);
}

/* ---------- tasks ---------- */

const TASK_COLS = `id, project_id AS "projectId", title, status, owner, to_char(due, 'YYYY-MM-DD') AS due, to_char(start, 'YYYY-MM-DD') AS start,
  priority, notes, meeting_id AS "meetingId", turn, position, to_char(created_at, 'YYYY-MM-DD') AS "createdAt"`;

export async function createTask(db: Db, input: NewTask): Promise<string> {
  const t = NewTask.parse(input);
  const id = newId();
  const last = (await db.query<{ p: number | null }>('SELECT max(position) AS p FROM tasks WHERE project_id = $1 AND status = $2', [t.projectId, t.status])).rows[0]?.p;
  await db.query(
    `INSERT INTO tasks (id, project_id, title, status, owner, due, start, priority, notes, meeting_id, turn, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [id, t.projectId, t.title, t.status, t.owner, t.due, t.start, t.priority, t.notes, t.meetingId, t.turn, positionBetween(last === null || last === undefined ? null : Number(last), null)],
  );
  return id;
}

export async function getTask(db: Db, id: string): Promise<Task | null> {
  return (await db.query<Task>(`SELECT ${TASK_COLS} FROM tasks WHERE id = $1`, [id])).rows[0] ?? null;
}

/** A project's tasks in board order: by status, then position. */
export async function listTasks(db: Db, projectId: string): Promise<Task[]> {
  return (await db.query<Task>(`SELECT ${TASK_COLS} FROM tasks WHERE project_id = $1 ORDER BY position, created_at`, [projectId])).rows;
}

/** Tasks across all projects, optionally for one owner. */
export async function listAllTasks(db: Db, opts: { owner?: string } = {}): Promise<Task[]> {
  return opts.owner
    ? (await db.query<Task>(`SELECT ${TASK_COLS} FROM tasks WHERE owner = $1 ORDER BY due NULLS LAST, position`, [opts.owner])).rows
    : (await db.query<Task>(`SELECT ${TASK_COLS} FROM tasks ORDER BY due NULLS LAST, position`)).rows;
}

const PATCH_COLUMNS: Record<keyof TaskPatch, string> = {
  title: 'title', status: 'status', owner: 'owner', due: 'due', start: 'start', priority: 'priority', notes: 'notes', projectId: 'project_id',
};

/** Applies a validated change. Throws a readable error for invalid input. */
export async function updateTask(db: Db, id: string, patch: TaskPatch): Promise<Task | null> {
  const p = TaskPatch.parse(patch);
  const keys = (Object.keys(p) as (keyof TaskPatch)[]).filter((k) => p[k] !== undefined);
  if (keys.length) {
    const sets = keys.map((k, i) => `${PATCH_COLUMNS[k]} = $${i + 2}`).join(', ');
    await db.query(`UPDATE tasks SET ${sets} WHERE id = $1`, [id, ...keys.map((k) => p[k])]);
  }
  return getTask(db, id);
}

/** Moves a task to a status column, placed just before `beforeId`, or at the end of the column. */
export async function moveTask(db: Db, id: string, status: Status, beforeId: string | null): Promise<void> {
  const task = await getTask(db, id);
  if (!task) return;
  const lane = (await db.query<{ id: string; position: number }>('SELECT id, position FROM tasks WHERE project_id = $1 AND status = $2 AND id <> $3 ORDER BY position', [task.projectId, status, id])).rows;
  const i = beforeId ? lane.findIndex((t) => t.id === beforeId) : -1;
  const pos = i >= 0
    ? positionBetween(i > 0 ? Number(lane[i - 1].position) : null, Number(lane[i].position))
    : positionBetween(lane.length ? Number(lane[lane.length - 1].position) : null, null);
  await db.query('UPDATE tasks SET status = $2, position = $3 WHERE id = $1', [id, status, pos]);
}

export async function deleteTask(db: Db, id: string): Promise<void> {
  await db.query('DELETE FROM tasks WHERE id = $1', [id]);
}

/** Names that appear as task owners or meeting speakers, for owner pickers. */
export async function listPeople(db: Db): Promise<string[]> {
  const rows = (
    await db.query<{ name: string }>(
      `SELECT owner AS name FROM tasks WHERE owner NOT IN ('Unassigned', 'Team')
       UNION SELECT jsonb_array_elements_text(speakers) FROM meetings ORDER BY 1`,
    )
  ).rows;
  return rows.map((r) => r.name).filter((n) => n && n !== 'Speaker');
}

/* ---------- meetings ---------- */

export interface Meeting {
  id: string;
  projectId: string | null;
  title: string;
  titleEdited: boolean;
  heldOn: string | null;
  format: string;
  wake: string;
  redact: boolean;
  domains: string;
  external: string[];
  speakers: string[];
  turns: Turn[];
  analysis: Analysis;
  board: BoardNode[] | null;
  chat: { role: 'user' | 'assistant'; content: string }[];
  createdAt: string;
}
/** One note on the meeting whiteboard. */
export interface BoardNode { id: string; kind: 'topic' | 'decision' | 'action' | 'question' | 'risk' | 'note'; text: string; owner?: string; turn?: number; x: number; y: number }

export interface MeetingSummary {
  id: string;
  projectId: string | null;
  title: string;
  heldOn: string | null;
  summary: string;
  toReview: number;
  onBoard: number;
}

export interface MeetingAction {
  id: string;
  meetingId: string;
  task: string;
  owner: string;
  dueSaid: string | null;
  due: string | null;
  priority: 'high' | 'medium' | 'low';
  turn: number;
  taskId: string | null;
}

const MEETING_COLS = `id, project_id AS "projectId", title, title_edited AS "titleEdited", to_char(held_on, 'YYYY-MM-DD') AS "heldOn", format, wake, redact, domains,
  external, speakers, turns, analysis, board, chat, to_char(created_at, 'YYYY-MM-DD') AS "createdAt"`;
const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);
const toMeeting = (r: Record<string, unknown>): Meeting =>
  ({ ...r, external: json(r.external), speakers: json(r.speakers), turns: json(r.turns), analysis: json(r.analysis), board: json(r.board), chat: json(r.chat) }) as Meeting;

export async function createMeeting(
  db: Db,
  m: Omit<Meeting, 'id' | 'createdAt' | 'board' | 'chat'>,
): Promise<string> {
  const id = newId();
  await db.query(
    `INSERT INTO meetings (id, project_id, title, title_edited, held_on, format, wake, redact, domains, external, speakers, turns, analysis, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14)`,
    [id, m.projectId, m.title, m.titleEdited, m.heldOn, m.format, m.wake, m.redact, m.domains, JSON.stringify(m.external), JSON.stringify(m.speakers), JSON.stringify(m.turns), JSON.stringify(m.analysis), m.analysis.summary],
  );
  return id;
}

export async function getMeeting(db: Db, id: string): Promise<Meeting | null> {
  const r = (await db.query<Record<string, unknown>>(`SELECT ${MEETING_COLS} FROM meetings WHERE id = $1`, [id])).rows[0];
  return r ? toMeeting(r) : null;
}

/** Meetings newest first, with how many action items wait for review. */
export async function listMeetings(db: Db, opts: { projectId?: string } = {}): Promise<MeetingSummary[]> {
  const where = opts.projectId ? 'WHERE m.project_id = $1' : '';
  return (
    await db.query<MeetingSummary>(
      `SELECT m.id, m.project_id AS "projectId", m.title, to_char(m.held_on, 'YYYY-MM-DD') AS "heldOn", m.summary,
         (SELECT count(*)::int FROM meeting_actions a WHERE a.meeting_id = m.id AND a.task_id IS NULL) AS "toReview",
         (SELECT count(*)::int FROM meeting_actions a WHERE a.meeting_id = m.id AND a.task_id IS NOT NULL) AS "onBoard"
       FROM meetings m ${where} ORDER BY m.held_on DESC NULLS LAST, m.created_at DESC`,
      opts.projectId ? [opts.projectId] : [],
    )
  ).rows;
}

export async function updateMeeting(
  db: Db,
  id: string,
  patch: Partial<Pick<Meeting, 'title' | 'titleEdited' | 'projectId' | 'heldOn' | 'redact' | 'board' | 'chat'>>,
): Promise<void> {
  const cols: Record<string, [string, unknown]> = {
    title: ['title', patch.title], titleEdited: ['title_edited', patch.titleEdited], projectId: ['project_id', patch.projectId],
    heldOn: ['held_on', patch.heldOn], redact: ['redact', patch.redact],
    board: ['board', patch.board === undefined ? undefined : JSON.stringify(patch.board)], chat: ['chat', patch.chat === undefined ? undefined : JSON.stringify(patch.chat)],
  };
  const sets = Object.values(cols).filter(([, v]) => v !== undefined);
  if (!sets.length) return;
  const sql = sets.map(([c], i) => `${c} = $${i + 2}${c === 'board' || c === 'chat' ? '::jsonb' : ''}`).join(', ');
  await db.query(`UPDATE meetings SET ${sql} WHERE id = $1`, [id, ...sets.map(([, v]) => v)]);
}

/**
 * Stores a new analysis. Action items already sent to a board are kept; the others are replaced by `actions`,
 * leaving out any at a line where a sent item already sits.
 */
export async function setMeetingAnalysis(db: Db, id: string, analysis: Analysis, actions: (ProposedAction & { dueDate: string | null })[]): Promise<void> {
  const m = await getMeeting(db, id);
  if (!m) return;
  await db.query(
    `UPDATE meetings SET analysis = $2::jsonb, summary = $3, board = NULL, title = CASE WHEN title_edited OR $4 = '' THEN title ELSE $4 END WHERE id = $1`,
    [id, JSON.stringify(analysis), analysis.summary, analysis.title],
  );
  await db.query('DELETE FROM meeting_actions WHERE meeting_id = $1 AND task_id IS NULL', [id]);
  const sentTurns = new Set((await listMeetingActions(db, id)).map((a) => a.turn));
  let pos = 0;
  for (const a of actions) {
    if (sentTurns.has(a.turn)) continue;
    await db.query(
      'INSERT INTO meeting_actions (id, meeting_id, task, owner, due_said, due, priority, turn, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [newId(), id, a.task, a.owner, a.due, a.dueDate, a.priority, a.turn, pos++],
    );
  }
}

/** Replaces the stored analysis as is, without touching action items (used to save results of in-call requests). */
export async function saveAnalysis(db: Db, id: string, analysis: Analysis): Promise<void> {
  await db.query('UPDATE meetings SET analysis = $2::jsonb WHERE id = $1', [id, JSON.stringify(analysis)]);
}

export async function listMeetingActions(db: Db, meetingId: string): Promise<MeetingAction[]> {
  return (
    await db.query<MeetingAction>(
      `SELECT id, meeting_id AS "meetingId", task, owner, due_said AS "dueSaid", to_char(due, 'YYYY-MM-DD') AS due, priority, turn, task_id AS "taskId"
       FROM meeting_actions WHERE meeting_id = $1 ORDER BY position, turn`,
      [meetingId],
    )
  ).rows;
}

export async function getMeetingAction(db: Db, id: string): Promise<MeetingAction | null> {
  return (
    await db.query<MeetingAction>(
      `SELECT id, meeting_id AS "meetingId", task, owner, due_said AS "dueSaid", to_char(due, 'YYYY-MM-DD') AS due, priority, turn, task_id AS "taskId" FROM meeting_actions WHERE id = $1`,
      [id],
    )
  ).rows[0] ?? null;
}

export async function addMeetingAction(db: Db, meetingId: string, a: { task: string; owner?: string; turn?: number }): Promise<string> {
  const id = newId();
  const pos = (await db.query<{ p: number | null }>('SELECT max(position) AS p FROM meeting_actions WHERE meeting_id = $1', [meetingId])).rows[0]?.p ?? -1;
  await db.query('INSERT INTO meeting_actions (id, meeting_id, task, owner, turn, position) VALUES ($1, $2, $3, $4, $5, $6)', [id, meetingId, a.task, a.owner ?? 'Unassigned', a.turn ?? 0, Number(pos) + 1]);
  return id;
}

/** Edits an action item that has not been sent yet. */
export async function updateMeetingAction(db: Db, id: string, patch: { task?: string; owner?: string; due?: string | null; priority?: string }): Promise<void> {
  const map: [string, unknown][] = [['task', patch.task?.trim() || undefined], ['owner', patch.owner === undefined ? undefined : patch.owner.trim() || 'Unassigned'], ['due', patch.due === undefined ? undefined : patch.due || null], ['priority', patch.priority]];
  const sets = map.filter(([, v]) => v !== undefined);
  if (!sets.length) return;
  await db.query(`UPDATE meeting_actions SET ${sets.map(([c], i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 AND task_id IS NULL`, [id, ...sets.map(([, v]) => v)]);
}

export async function deleteMeetingAction(db: Db, id: string): Promise<void> {
  await db.query('DELETE FROM meeting_actions WHERE id = $1 AND task_id IS NULL', [id]);
}

export async function linkActionToTask(db: Db, actionId: string, taskId: string): Promise<void> {
  await db.query('UPDATE meeting_actions SET task_id = $2 WHERE id = $1', [actionId, taskId]);
}

/** Deletes a meeting. Tasks created from it stay on their boards, without the link. */
export async function deleteMeeting(db: Db, id: string): Promise<void> {
  await db.query('UPDATE tasks SET meeting_id = NULL, turn = NULL WHERE meeting_id = $1', [id]);
  await db.query('DELETE FROM meetings WHERE id = $1', [id]);
}

/** For tasks that came from a meeting: the meeting's title, date and the quoted line. */
export async function meetingOrigins(db: Db, meetingIds: string[]): Promise<Map<string, { title: string; heldOn: string | null; turns: Turn[] }>> {
  if (!meetingIds.length) return new Map();
  const rows = (await db.query<{ id: string; title: string; heldOn: string | null; turns: unknown }>(
    `SELECT id, title, to_char(held_on, 'YYYY-MM-DD') AS "heldOn", turns FROM meetings WHERE id = ANY($1::text[])`, [meetingIds],
  )).rows;
  return new Map(rows.map((r) => [r.id, { title: r.title, heldOn: r.heldOn, turns: json(r.turns) as Turn[] }]));
}

/* ---------- documents ---------- */

export interface DocumentRow { id: string; projectId: string | null; meetingId: string | null; name: string; template: string; body: string; writtenBy: string; createdAt: string }
const DOC_COLS = `id, project_id AS "projectId", meeting_id AS "meetingId", name, template, body, written_by AS "writtenBy", to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"`;

export async function createDocument(db: Db, d: { projectId?: string | null; meetingId?: string | null; name: string; template: string; body: string; writtenBy: string }): Promise<string> {
  const id = newId();
  await db.query('INSERT INTO documents (id, project_id, meeting_id, name, template, body, written_by) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, d.projectId ?? null, d.meetingId ?? null, d.name, d.template, d.body, d.writtenBy]);
  return id;
}

export async function listDocuments(db: Db, owner: { projectId?: string; meetingId?: string }): Promise<DocumentRow[]> {
  return owner.meetingId
    ? (await db.query<DocumentRow>(`SELECT ${DOC_COLS} FROM documents WHERE meeting_id = $1 ORDER BY created_at DESC`, [owner.meetingId])).rows
    : (await db.query<DocumentRow>(`SELECT ${DOC_COLS} FROM documents WHERE project_id = $1 AND meeting_id IS NULL ORDER BY created_at DESC`, [owner.projectId])).rows;
}

export async function deleteDocument(db: Db, id: string): Promise<void> {
  await db.query('DELETE FROM documents WHERE id = $1', [id]);
}

/** Everything a profile is written from. */
export async function getProjectSource(db: Db, projectId: string): Promise<ProjectSource | null> {
  const project = await getProject(db, projectId);
  if (!project) return null;
  const tasks = await listTasks(db, projectId);
  const meetings = (
    await db.query<{ title: string; summary: string; analysis: { decisions?: { text: string }[] } }>(
      'SELECT title, summary, analysis FROM meetings WHERE project_id = $1 ORDER BY held_on NULLS LAST',
      [projectId],
    )
  ).rows;
  return {
    name: project.name,
    description: project.description,
    tasks: tasks.map((t) => ({ title: t.title, notes: t.notes })),
    meetings: meetings.map((m) => ({ title: m.title, summary: m.summary, decisions: (m.analysis?.decisions ?? []).map((d) => d.text) })),
  };
}

interface ProfileRow {
  project_id: string;
  profile: ProjectProfile;
  embedding: unknown;
  embedding_model: string;
  extractor: string;
  content_hash: string;
}
const toStored = (r: ProfileRow): StoredProfile => ({
  projectId: r.project_id,
  profile: typeof r.profile === 'string' ? (JSON.parse(r.profile) as ProjectProfile) : r.profile,
  embedding: fromVector(r.embedding),
  embeddingModel: r.embedding_model,
  extractor: r.extractor,
  contentHash: r.content_hash,
});

export async function getProfile(db: Db, projectId: string): Promise<StoredProfile | null> {
  const r = (await db.query<ProfileRow>('SELECT project_id, profile, embedding::text AS embedding, embedding_model, extractor, content_hash FROM project_profiles WHERE project_id = $1', [projectId])).rows[0];
  return r ? toStored(r) : null;
}

export async function listProfiles(db: Db, embeddingModel?: string): Promise<StoredProfile[]> {
  const rows = embeddingModel
    ? await db.query<ProfileRow>('SELECT project_id, profile, embedding::text AS embedding, embedding_model, extractor, content_hash FROM project_profiles WHERE embedding_model = $1', [embeddingModel])
    : await db.query<ProfileRow>('SELECT project_id, profile, embedding::text AS embedding, embedding_model, extractor, content_hash FROM project_profiles');
  return rows.rows.map(toStored);
}

export async function upsertProfile(db: Db, p: StoredProfile): Promise<void> {
  await db.query(
    `INSERT INTO project_profiles (project_id, profile, embedding, embedding_model, extractor, content_hash, updated_at)
     VALUES ($1, $2::jsonb, $3::vector, $4, $5, $6, now())
     ON CONFLICT (project_id) DO UPDATE SET profile = EXCLUDED.profile, embedding = EXCLUDED.embedding,
       embedding_model = EXCLUDED.embedding_model, extractor = EXCLUDED.extractor, content_hash = EXCLUDED.content_hash, updated_at = now()`,
    [p.projectId, JSON.stringify(p.profile), toVector(p.embedding), p.embeddingModel, p.extractor, p.contentHash],
  );
}

/**
 * Nearest projects by embedding alone, computed in the database with pgvector.
 * Use this to shortlist candidates when the portfolio is large; the hybrid score then reranks them.
 */
export async function nearestByEmbedding(db: Db, projectId: string, limit = 20): Promise<{ projectId: string; similarity: number }[]> {
  const rows = await db.query<{ project_id: string; similarity: number }>(
    `SELECT o.project_id, 1 - (o.embedding <=> t.embedding) AS similarity
       FROM project_profiles t
       JOIN project_profiles o ON o.project_id <> t.project_id AND o.embedding_model = t.embedding_model
      WHERE t.project_id = $1
      ORDER BY o.embedding <=> t.embedding
      LIMIT $2`,
    [projectId, limit],
  );
  return rows.rows.map((r) => ({ projectId: r.project_id, similarity: Number(r.similarity) }));
}
