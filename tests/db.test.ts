import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openEmbedded, type Db } from '@/lib/db/client';
import { createTask, getProfile, listProjects, nearestByEmbedding } from '@/lib/db/repo';
import { loadExamples } from '@/lib/examples';
import { cosine } from '@/lib/similarity';
import { refreshAllProfiles, refreshProfile, similarProjects } from '@/lib/services/profiles';

/* Runs against the embedded Postgres with pgvector, in memory, with the offline extractor and local embedder. */
let db: Db;
const offline = { complete: null };

beforeAll(async () => {
  db = await openEmbedded();
  await loadExamples(db);
  await refreshAllProfiles(db, offline);
});
afterAll(() => db.close());

describe('profiles in the database', () => {
  it('writes one profile per example project', async () => {
    expect((await listProjects(db)).length).toBe(6);
    const p = await getProfile(db, 'warehouse');
    expect(p?.profile.technologies).toEqual(expect.arrayContaining(['snowflake', 'dbt', 'airflow', 'salesforce']));
    expect(p?.embedding.length).toBe(512);
    expect(p?.extractor).toBe('offline');
  });

  it('skips unchanged projects and rewrites changed ones', async () => {
    expect((await refreshProfile(db, 'website', offline)).changed).toBe(false);
    await createTask(db, { projectId: 'website', title: 'Add Stripe checkout to the pricing page' });
    const again = await refreshProfile(db, 'website', offline);
    expect(again.changed).toBe(true);
    expect(again.profile.profile.technologies).toContain('stripe');
  });

  it('pairs the two reporting projects and the two event projects', async () => {
    expect((await similarProjects(db, 'warehouse', 1))[0].projectId).toBe('sales-reporting');
    expect((await similarProjects(db, 'summit', 1))[0].projectId).toBe('roadshow');
    const top = (await similarProjects(db, 'sales-reporting', 1))[0];
    expect(top.shared.technologies).toEqual(expect.arrayContaining(['snowflake', 'powerbi', 'salesforce']));
  });

  it('finds nearest projects with pgvector in SQL', async () => {
    const near = await nearestByEmbedding(db, 'warehouse', 5);
    expect(near).toHaveLength(5);
    // Same numbers and same order as cosine similarity computed in the app.
    const target = (await getProfile(db, 'warehouse'))!;
    for (const n of near) expect(n.similarity).toBeCloseTo(cosine(target.embedding, (await getProfile(db, n.projectId))!.embedding), 4);
    expect(near.map((n) => n.similarity)).toEqual([...near.map((n) => n.similarity)].sort((a, b) => b - a));
  });
});
