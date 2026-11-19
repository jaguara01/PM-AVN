'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addActionItem, dismissActionItem, editActionItem, sendActionItem, sendAllActionItems } from '@/app/meeting-actions';
import type { MeetingAction } from '@/lib/db/repo';
import { STATUS_NAME, type Status } from '@/lib/tasks';
import { StatusIcon } from './task-bits';

export function ActionItems({ meetingId, items, projectName, projectId, people, taskStatus }: {
  meetingId: string; items: MeetingAction[]; projectName: string | null; projectId: string | null; people: string[]; taskStatus: Record<string, { status: Status; title: string; owner: string; due: string | null }>;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const waiting = items.filter((a) => !a.taskId);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const r = await fn();
    setError(r.ok ? '' : (r as { error: string }).error);
    router.refresh();
  });

  return (
    <section className="card c2">
      <div className="bar between">
        <p className="sub" style={{ margin: 0 }}>
          {projectName ? <>Check owners and dates, then send them to the <Link href={`/projects/${projectId}`}><b>{projectName}</b></Link> board.</> : 'Choose a project at the top of the page to send these to its board.'}
        </p>
        {waiting.length > 0 && <button type="button" className="btn solid" disabled={!projectId || pending} onClick={() => act(() => sendAllActionItems(meetingId))}>Send all {waiting.length} to the board</button>}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <datalist id="ai-people">{people.map((p) => <option key={p} value={p} />)}<option value="Unassigned" /></datalist>
      <div className="acts">
        {items.length === 0 && <p className="muted">Nothing in this transcript read like a commitment. Add one below if something was missed.</p>}
        {items.map((a) => {
          const t = a.taskId ? taskStatus[a.taskId] : undefined;
          return (
            <div key={a.id} className={`act ${a.taskId ? 'sent' : ''}`}>
              {t ? (
                <>
                  <div className="act-main"><p className="act-title">{t.title}</p><p className="muted small">{t.owner}{t.due ? `, due ${t.due}` : ''}</p></div>
                  <div className="act-side"><Link className="ref" href={`/meetings/${meetingId}/transcript#turn-${a.turn}`}>{a.turn}</Link>
                    <Link className="btn sm" href={`/projects/${projectId}`}><StatusIcon status={t.status} />{STATUS_NAME[t.status]}</Link></div>
                </>
              ) : (
                <>
                  <div className="act-main">
                    <label className="sr" htmlFor={`a-${a.id}-task`}>Action item</label>
                    <textarea id={`a-${a.id}-task`} rows={2} defaultValue={a.task} onBlur={(e) => e.target.value.trim() !== a.task && act(() => editActionItem(a.id, { task: e.target.value }))} />
                    <div className="afields">
                      <label>Owner<input list="ai-people" defaultValue={a.owner} onBlur={(e) => e.target.value !== a.owner && act(() => editActionItem(a.id, { owner: e.target.value }))} /></label>
                      <label>Due{a.dueSaid && <i className="said"> said “{a.dueSaid}”</i>}<input type="date" defaultValue={a.due ?? ''} onChange={(e) => act(() => editActionItem(a.id, { due: e.target.value || null }))} /></label>
                      <label>Priority
                        <select defaultValue={a.priority} onChange={(e) => act(() => editActionItem(a.id, { priority: e.target.value }))}>
                          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="act-side">
                    <Link className="ref" href={`/meetings/${meetingId}/transcript#turn-${a.turn}`} title={`Line ${a.turn} of the transcript`}>{a.turn}</Link>
                    <button type="button" className="btn sm solid" disabled={!projectId || pending} onClick={() => act(() => sendActionItem(a.id))}>Send to board</button>
                    <button type="button" className="btn sm quiet" disabled={pending} onClick={() => act(() => dismissActionItem(a.id))}>Dismiss</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="bar"><button type="button" className="btn" disabled={pending} onClick={() => act(() => addActionItem(meetingId))}>Add an action item</button></div>
    </section>
  );
}
