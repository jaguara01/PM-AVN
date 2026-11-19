'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createTaskAction, moveTaskAction } from '@/app/task-actions';
import { dueLabel } from '@/lib/dates';
import { STATUSES, STATUS_NAME, isLate, type Status, type Task } from '@/lib/tasks';
import { Avatar, PriorityIcon, StatusIcon } from './task-bits';
import { Diamond, useTaskPanel } from './task-panel';

/** Four status lanes. Cards move by drag and drop (mouse) or by the status control in the task panel (keyboard, touch). */
export function Board({ projectId, ownerFilter }: { projectId: string; ownerFilter?: string }) {
  const router = useRouter();
  const { open, data } = useTaskPanel();
  const [tasks, setTasks] = useState<Task[]>(data.tasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [error, setError] = useState('');
  useEffect(() => setTasks(data.tasks), [data.tasks]);

  const shown = ownerFilter ? tasks.filter((t) => t.owner === ownerFilter) : tasks;

  async function drop(status: Status, beforeId: string | null) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (!id || id === beforeId) return;
    // Show the move straight away, then save it.
    setTasks((all) => {
      const moving = all.find((t) => t.id === id);
      if (!moving) return all;
      const rest = all.filter((t) => t.id !== id);
      const updated = { ...moving, status };
      const i = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
      if (i < 0) rest.push(updated);
      else rest.splice(i, 0, updated);
      return rest;
    });
    const r = await moveTaskAction(id, status, beforeId);
    if (!r.ok) setError(r.error);
    router.refresh();
  }

  async function quickAdd(status: Status, input: HTMLInputElement) {
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    const r = await createTaskAction({ projectId, title, status, owner: ownerFilter || undefined });
    if (!r.ok) setError(r.error);
    router.refresh();
  }

  return (
    <>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="board">
        {STATUSES.map((status) => {
          const lane = shown.filter((t) => t.status === status);
          return (
            <section key={status} className={`lane lane-${status} ${over === status ? 'over' : ''}`}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(status); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={(e) => {
                e.preventDefault();
                const card = (e.target as HTMLElement).closest<HTMLElement>('[data-task]');
                drop(status, card?.dataset.task ?? null);
              }}>
              <h3><StatusIcon status={status} /><span>{STATUS_NAME[status]}</span><span className="count">{lane.length}</span></h3>
              <div className="cards">
                {lane.map((t) => (
                  <article key={t.id} data-task={t.id} className={`tcard ${dragId === t.id ? 'dragging' : ''}`} draggable
                    onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); }}
                    onDragEnd={() => { setDragId(null); setOver(null); }}>
                    <button type="button" className="tcard-open" onClick={() => open(t.id)}>{t.title}</button>
                    <div className="cmeta">
                      {t.meetingId && <span className="srcwrap" title="From a meeting"><Diamond /></span>}
                      <PriorityIcon priority={t.priority} />
                      <span className={`td ${isLate(t, data.today) ? 'late' : ''}`}>{dueLabel(t.due, data.today)}</span>
                      <span className="grow" />
                      <Avatar name={t.owner} />
                    </div>
                  </article>
                ))}
              </div>
              <label className="sr" htmlFor={`qa-${status}`}>Add a task to {STATUS_NAME[status]}</label>
              <input id={`qa-${status}`} className="qa" placeholder="Add a task" onKeyDown={(e) => e.key === 'Enter' && quickAdd(status, e.currentTarget)} />
            </section>
          );
        })}
      </div>
    </>
  );
}
