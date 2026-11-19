'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { deleteTaskAction, updateTaskAction } from '@/app/task-actions';
import { dueLabel, fmtDay } from '@/lib/dates';
import { PRIORITIES, STATUSES, STATUS_NAME, isLate, nextStatus, type Task, type TaskPatch } from '@/lib/tasks';
import { StatusIcon } from './task-bits';

/** Where a task came from, when it was created from a meeting. */
export interface TaskSource {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string | null;
  turn: number | null;
  speaker?: string;
  text?: string;
}

export interface TaskContextData {
  tasks: Task[];
  people: string[];
  projects: { id: string; name: string }[];
  sources?: Record<string, TaskSource>;
  today: string;
}

const Ctx = createContext<{ open: (id: string) => void; data: TaskContextData } | null>(null);

export function useTaskPanel() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTaskPanel must be used inside TaskPanelProvider');
  return c;
}

/** Makes `open(taskId)` available to everything inside it and renders the task panel. */
export function TaskPanelProvider({ data, children }: { data: TaskContextData; children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = useCallback((id: string) => setOpenId(id), []);
  const value = useMemo(() => ({ open, data }), [open, data]);
  const task = openId ? data.tasks.find((t) => t.id === openId) : undefined;
  return (
    <Ctx.Provider value={value}>
      {children}
      {task && <TaskPanel key={task.id} task={task} data={data} onClose={() => setOpenId(null)} />}
    </Ctx.Provider>
  );
}

/** A row or chip that opens a task. Renders as a button so it works with the keyboard. */
export function TaskButton({ id, className, style, title, children }: { id: string; className?: string; style?: React.CSSProperties; title?: string; children: React.ReactNode }) {
  const { open } = useTaskPanel();
  return <button type="button" className={className} style={style} title={title} onClick={() => open(id)}>{children}</button>;
}

function TaskPanel({ task, data, onClose }: { task: Task; data: TaskContextData; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [title, setTitle] = useState(task.title);
  const [armed, setArmed] = useState(false);
  const source = data.sources?.[task.id];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(patch: TaskPatch) {
    const r = await updateTaskAction(task.id, patch);
    if (!r.ok) setError(r.error);
    else {
      setError('');
      router.refresh();
    }
  }

  async function remove() {
    if (!armed) return setArmed(true);
    await deleteTaskAction(task.id);
    onClose();
    router.refresh();
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Task: ${task.title}`}>
        <div className="bar between">
          <button type="button" className="btn" onClick={() => save({ status: nextStatus(task.status) })} title="Move to the next status">
            <StatusIcon status={task.status} />{STATUS_NAME[task.status]}
          </button>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <label className="sr" htmlFor="tf-title">Title</label>
        <textarea id="tf-title" className="dtitle" rows={Math.min(5, Math.max(1, Math.ceil(title.length / 34)))} value={title}
          onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() !== task.title && save({ title })} />
        {error && <p className="err" role="alert">{error}</p>}
        <div className="fgrid">
          <label>Status
            <select id="tf-status" value={task.status} onChange={(e) => save({ status: e.target.value as Task['status'] })}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_NAME[s]}</option>)}
            </select>
          </label>
          <label>Owner
            <input id="tf-owner" list="tf-people" defaultValue={task.owner} onBlur={(e) => e.target.value !== task.owner && save({ owner: e.target.value })} />
          </label>
          <label>Start
            <input id="tf-start" type="date" defaultValue={task.start ?? ''} onChange={(e) => save({ start: e.target.value || null })} />
          </label>
          <label>Due
            <input id="tf-due" type="date" className={isLate(task, data.today) ? 'late' : ''} defaultValue={task.due ?? ''} onChange={(e) => save({ due: e.target.value || null })} />
          </label>
          <label>Priority
            <select id="tf-priority" value={task.priority} onChange={(e) => save({ priority: e.target.value as Task['priority'] })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
          </label>
          <label>Project
            <select id="tf-project" value={task.projectId} onChange={(e) => save({ projectId: e.target.value })}>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <label>Notes
          <textarea id="tf-notes" rows={5} defaultValue={task.notes} onBlur={(e) => e.target.value !== task.notes && save({ notes: e.target.value })} />
        </label>
        <datalist id="tf-people">{data.people.map((p) => <option key={p} value={p} />)}<option value="Unassigned" /></datalist>
        {source && (
          <div className="origin">
            <p><Diamond /><span>From <Link href={`/meetings/${source.meetingId}/transcript${source.turn !== null ? `#turn-${source.turn}` : ''}`}>{source.meetingTitle}</Link>{source.meetingDate ? `, ${fmtDay(source.meetingDate)}` : ''}</span></p>
            {source.text && <blockquote><b>{source.speaker}</b> {source.text}</blockquote>}
          </div>
        )}
        <div className="grow" />
        <div className="bar between">
          <span className="muted small">Created {fmtDay(task.createdAt)}{task.due ? `, due ${dueLabel(task.due, data.today).toLowerCase()}` : ''}</span>
          <button type="button" className="btn quiet" onClick={remove}>{armed ? 'Click again to delete' : 'Delete task'}</button>
        </div>
      </aside>
    </>
  );
}

export function Diamond() {
  return <svg className="src" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .8 11.2 6 6 11.2.8 6z" fill="currentColor" /></svg>;
}
