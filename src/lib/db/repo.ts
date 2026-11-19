import { randomUUID } from 'node:crypto';
import type { Db } from './client';
import type { ProjectProfile, ProjectSource, StoredProfile } from '@/lib/similarity';
import { NewTask, TaskPatch, positionBetween, type Status, type Task } from '@/lib/tasks';

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

/** Names that appear as task owners, for owner pickers. Meeting speakers are added when meetings exist. */
export async function listPeople(db: Db): Promise<string[]> {
  const rows = (await db.query<{ name: string }>(`SELECT DISTINCT owner AS name FROM tasks WHERE owner <> 'Unassigned' ORDER BY 1`)).rows;
  return rows.map((r) => r.name);
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
