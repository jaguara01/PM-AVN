'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateTaskAction } from '@/app/task-actions';
import { PRIORITIES, STATUSES, STATUS_NAME, isLate, type Task, type TaskPatch } from '@/lib/tasks';
import { Diamond, useTaskPanel } from './task-panel';

const COLS: [key: string, label: string][] = [['status', 'Status'], ['title', 'Task'], ['owner', 'Owner'], ['due', 'Due'], ['priority', 'Priority']];

/** A table where every field can be changed in place. Sorting is in the URL so a view can be shared. */
export function TaskList({ tasks, sort, dir }: { tasks: Task[]; sort: string; dir: 1 | -1 }) {
  const router = useRouter();
  const { open, data } = useTaskPanel();
  const [error, setError] = useState('');
  const save = async (id: string, patch: TaskPatch) => {
    const r = await updateTaskAction(id, patch);
    setError(r.ok ? '' : r.error);
    router.refresh();
  };
  const href = (k: string) => `?sort=${k}&dir=${sort === k && dir === 1 ? 'desc' : 'asc'}`;
  if (!tasks.length) return <p className="muted">No tasks yet. Add one on the board, or send action items over from a meeting.</p>;
  return (
    <>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="tw">
        <table className="list">
          <thead>
            <tr>
              {COLS.map(([k, l]) => (
                <th key={k} aria-sort={sort === k ? (dir === 1 ? 'ascending' : 'descending') : undefined}>
                  <Link href={href(k)} className={sort === k ? 'on' : ''}>{l}{sort === k ? (dir === 1 ? ' ↑' : ' ↓') : ''}</Link>
                </th>
              ))}
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const src = data.sources?.[t.id];
              return (
                <tr key={t.id} className={t.status === 'done' ? 'is-done' : ''}>
                  <td><select aria-label="Status" value={t.status} onChange={(e) => save(t.id, { status: e.target.value as Task['status'] })}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_NAME[s]}</option>)}</select></td>
                  <td className="ltitle"><button type="button" className="linkbtn plain" onClick={() => open(t.id)}>{t.title}</button></td>
                  <td><input aria-label="Owner" list="tl-people" defaultValue={t.owner} onBlur={(e) => e.target.value !== t.owner && save(t.id, { owner: e.target.value })} /></td>
                  <td><input aria-label="Due date" type="date" className={isLate(t, data.today) ? 'late' : ''} defaultValue={t.due ?? ''} onChange={(e) => save(t.id, { due: e.target.value || null })} /></td>
                  <td><select aria-label="Priority" value={t.priority} onChange={(e) => save(t.id, { priority: e.target.value as Task['priority'] })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></td>
                  <td>{src && <Link className="srclink" href={`/meetings/${src.meetingId}`}><Diamond />{src.meetingTitle}</Link>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <datalist id="tl-people">{data.people.map((p) => <option key={p} value={p} />)}<option value="Unassigned" /></datalist>
    </>
  );
}
