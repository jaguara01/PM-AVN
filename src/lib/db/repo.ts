import { randomUUID } from 'node:crypto';
import type { Db } from './client';
import type { ProjectProfile, ProjectSource, StoredProfile } from '@/lib/similarity';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: number;
}
export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: string;
  owner: string;
  due: string | null;
  notes: string;
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

export async function createTask(db: Db, input: { projectId: string; title: string; status?: string; owner?: string; due?: string | null; notes?: string }): Promise<string> {
  const id = newId();
  await db.query('INSERT INTO tasks (id, project_id, title, status, owner, due, notes, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
    id, input.projectId, input.title, input.status ?? 'todo', input.owner ?? 'Unassigned', input.due ?? null, input.notes ?? '', Date.now(),
  ]);
  return id;
}

export async function listTasks(db: Db, projectId: string): Promise<Task[]> {
  return (
    await db.query<Task>(
      `SELECT id, project_id AS "projectId", title, status, owner, to_char(due, 'YYYY-MM-DD') AS due, notes FROM tasks WHERE project_id = $1 ORDER BY position`,
      [projectId],
    )
  ).rows;
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
