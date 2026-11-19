'use client';

import { dueLabel } from '@/lib/dates';
import { isLate, type Task } from '@/lib/tasks';
import { Avatar, PriorityIcon, StatusIcon } from './task-bits';
import { Diamond, useTaskPanel } from './task-panel';

/** One task as a row: opens the task panel. Shows the project name when the list spans projects. */
export function TaskRow({ task: t, projectName, projectColor }: { task: Task; projectName?: string; projectColor?: string }) {
  const { open, data } = useTaskPanel();
  return (
    <button type="button" className={`trow ${t.status === 'done' ? 'is-done' : ''}`} onClick={() => open(t.id)}>
      <StatusIcon status={t.status} />
      <span className="tt">{t.title}{t.meetingId && <span className="srcwrap" title="From a meeting"><Diamond /></span>}</span>
      {projectName && <span className="tp"><i className="dot" style={{ background: projectColor }} />{projectName}</span>}
      <PriorityIcon priority={t.priority} />
      <span className={`td ${isLate(t, data.today) ? 'late' : ''}`}>{dueLabel(t.due, data.today)}</span>
      <Avatar name={t.owner} />
    </button>
  );
}

/** A small chip for the week strip. */
export function WeekChip({ task: t, color }: { task: Task; color: string }) {
  const { open } = useTaskPanel();
  return (
    <button type="button" className="wchip" style={{ ['--c' as string]: color }} onClick={() => open(t.id)}>
      <span>{t.title}</span><Avatar name={t.owner} size="xs" />
    </button>
  );
}
