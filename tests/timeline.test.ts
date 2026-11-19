import { describe, expect, it } from 'vitest';
import { buildTimeline, sortTasks } from '@/lib/timeline';
import type { Task } from '@/lib/tasks';

const task = (o: Partial<Task>): Task => ({ id: o.title ?? 'x', projectId: 'p', title: 'x', status: 'todo', owner: 'Ana', due: null, start: null, priority: 'medium', notes: '', meetingId: null, turn: null, position: 0, createdAt: '2026-11-01', ...o });

describe('timeline', () => {
  it('spans from start to due, counts undated tasks and marks today', () => {
    const tl = buildTimeline([task({ title: 'a', start: '2026-11-18', due: '2026-11-20' }), task({ title: 'b' })], '2026-11-19');
    expect(tl.undated).toBe(1);
    expect(tl.bars).toHaveLength(1);
    expect(tl.bars[0].span).toBe(3);
    expect(tl.days[tl.todayIndex!]).toBe('2026-11-19');
    expect(tl.days[tl.bars[0].from]).toBe('2026-11-18');
  });
  it('keeps a start date after the due date from breaking the bar', () => {
    const tl = buildTimeline([task({ start: '2026-12-10', due: '2026-12-01' })], '2026-11-19');
    expect(tl.bars[0].span).toBe(1);
  });
  it('caps very long windows', () => {
    const tl = buildTimeline([task({ due: '2028-01-01', start: '2026-11-01' })], '2026-11-19', 60);
    expect(tl.days.length).toBe(61);
  });
});

describe('sorting', () => {
  const ts = [task({ title: 'b', due: null, priority: 'low', status: 'done' }), task({ title: 'a', due: '2026-12-01', priority: 'high', status: 'doing' })];
  it('puts undated tasks last when sorting by date, and sorts both ways', () => {
    expect(sortTasks(ts, 'due', 1).map((t) => t.title)).toEqual(['a', 'b']);
    expect(sortTasks(ts, 'title', -1).map((t) => t.title)).toEqual(['b', 'a']);
    expect(sortTasks(ts, 'priority', 1).map((t) => t.title)).toEqual(['a', 'b']);
    expect(sortTasks(ts, 'status', 1).map((t) => t.title)).toEqual(['a', 'b']);
  });
});
