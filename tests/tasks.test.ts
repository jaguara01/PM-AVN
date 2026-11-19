import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openEmbedded, type Db } from '@/lib/db/client';
import { createProject, createTask, deleteProject, deleteTask, getTask, listAllTasks, listPeople, listTasks, moveTask, updateProject, updateTask } from '@/lib/db/repo';
import { addDays, diffDays, dueLabel, todayIso } from '@/lib/dates';
import { isLate, nextStatus, positionBetween } from '@/lib/tasks';
import { loadExamples } from '@/lib/examples';

let db: Db;
beforeAll(async () => {
  db = await openEmbedded();
  await createProject(db, { id: 'p', name: 'Pilot' });
});
afterAll(() => db.close());

const lane = async (status: string) => (await listTasks(db, 'p')).filter((t) => t.status === status).map((t) => t.title);

describe('dates', () => {
  it('adds and counts days across month ends', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
    expect(diffDays('2026-12-30', '2027-01-02')).toBe(3);
  });
  it('labels nearby days in words', () => {
    expect(dueLabel('2026-11-19', '2026-11-19')).toBe('Today');
    expect(dueLabel('2026-11-20', '2026-11-19')).toBe('Tomorrow');
    expect(dueLabel('2026-11-25', '2026-11-19')).toBe('Wed 25 Nov');
  });
  it('gives today as an ISO date', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('task rules', () => {
  it('cycles status and spots late tasks', () => {
    expect(nextStatus('done')).toBe('todo');
    expect(isLate({ status: 'doing', due: '2026-01-01' }, '2026-01-02')).toBe(true);
    expect(isLate({ status: 'done', due: '2026-01-01' }, '2026-01-02')).toBe(false);
  });
  it('places between neighbours', () => {
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(null, 1)).toBe(0);
    expect(positionBetween(4, null)).toBe(5);
  });
});

describe('tasks in the database', () => {
  it('creates tasks at the end of their column with defaults', async () => {
    await createTask(db, { projectId: 'p', title: 'A' });
    await createTask(db, { projectId: 'p', title: 'B' });
    await createTask(db, { projectId: 'p', title: 'C', status: 'doing', owner: ' Ana ', due: '2026-12-01', priority: 'high' });
    expect(await lane('todo')).toEqual(['A', 'B']);
    const c = (await listTasks(db, 'p')).find((t) => t.title === 'C')!;
    expect(c).toMatchObject({ owner: 'Ana', due: '2026-12-01', priority: 'high', status: 'doing' });
    expect((await listTasks(db, 'p')).find((t) => t.title === 'A')!.owner).toBe('Unassigned');
  });

  it('rejects an empty title and an invalid date', async () => {
    await expect(createTask(db, { projectId: 'p', title: '  ' })).rejects.toThrow(/needs a title/);
    const a = (await listTasks(db, 'p'))[0];
    await expect(updateTask(db, a.id, { due: '01/12/2026' })).rejects.toThrow(/date like/);
  });

  it('moves a task between columns and before another card', async () => {
    const all = await listTasks(db, 'p');
    const a = all.find((t) => t.title === 'A')!;
    const c = all.find((t) => t.title === 'C')!;
    await moveTask(db, a.id, 'doing', c.id);
    expect(await lane('doing')).toEqual(['A', 'C']);
    expect(await lane('todo')).toEqual(['B']);
    await moveTask(db, a.id, 'doing', null);
    expect(await lane('doing')).toEqual(['C', 'A']);
  });

  it('updates fields, clears a date and changes project', async () => {
    await createProject(db, { id: 'q', name: 'Other' });
    const b = (await listTasks(db, 'p')).find((t) => t.title === 'B')!;
    const updated = await updateTask(db, b.id, { title: 'B2', owner: '', due: '2026-12-24', notes: 'n' });
    expect(updated).toMatchObject({ title: 'B2', owner: 'Unassigned', due: '2026-12-24', notes: 'n' });
    expect((await updateTask(db, b.id, { due: null }))!.due).toBeNull();
    await updateTask(db, b.id, { projectId: 'q' });
    expect((await listTasks(db, 'q')).map((t) => t.title)).toEqual(['B2']);
  });

  it('lists people, filters by owner, deletes', async () => {
    expect(await listPeople(db)).toContain('Ana');
    expect((await listAllTasks(db, { owner: 'Ana' })).map((t) => t.title)).toEqual(['C']);
    const c = (await listAllTasks(db, { owner: 'Ana' }))[0];
    await deleteTask(db, c.id);
    expect(await getTask(db, c.id)).toBeNull();
  });

  it('renames and deletes a project with its tasks', async () => {
    await updateProject(db, 'q', { name: ' Renamed ', description: 'd' });
    await deleteProject(db, 'q');
    expect(await listTasks(db, 'q')).toEqual([]);
  });

  it('loads example tasks with owners and dates relative to today', async () => {
    const fresh = await openEmbedded();
    await loadExamples(fresh, '2026-11-19');
    const tasks = await listAllTasks(fresh);
    expect(tasks.length).toBeGreaterThan(25);
    expect(tasks.find((t) => t.title === 'Send save-the-date to customers')).toMatchObject({ due: '2026-11-18', owner: 'Priya Nair' });
    await fresh.close();
  });
});
