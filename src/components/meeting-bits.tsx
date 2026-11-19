'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { analyzeMeetingAction, removeMeeting, updateMeetingDetails } from '@/app/meeting-actions';
import { ConfirmButton, InlineText } from './inline-text';

export function MeetingHeader({ id, title, projectId, heldOn, projects, hasModel, writtenByModel }: {
  id: string; title: string; projectId: string | null; heldOn: string | null; projects: { id: string; name: string }[]; hasModel: boolean; writtenByModel: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const save = (patch: Parameters<typeof updateMeetingDetails>[1]) => start(async () => {
    const r = await updateMeetingDetails(id, patch);
    setError(r.ok ? '' : r.error);
    router.refresh();
  });
  return (
    <section className="top mtop">
      <div className="grow">
        <InlineText id="m-title" className="h1in" value={title} label="Meeting title" save={async (v) => { const r = await updateMeetingDetails(id, { title: v }); return r.ok ? undefined : r.error; }} />
      </div>
      <div className="bar">
        <label className="inl">Project
          <select value={projectId ?? ''} onChange={(e) => save({ projectId: e.target.value || null })}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="inl">Date<input type="date" defaultValue={heldOn ?? ''} onChange={(e) => e.target.value && save({ heldOn: e.target.value })} /></label>
        {hasModel && (
          <button type="button" className={`btn ${writtenByModel ? '' : 'solid'}`} disabled={pending}
            onClick={() => start(async () => { const r = await analyzeMeetingAction(id); setError(r.ok ? '' : r.error); router.refresh(); })}>
            {pending ? 'Reading…' : writtenByModel ? 'Rewrite notes' : 'Write notes with AI'}
          </button>
        )}
        <ConfirmButton label="Delete" confirmLabel="Click again to delete" action={() => removeMeeting(id)} />
      </div>
      {error && <p className="err" role="alert" style={{ flexBasis: '100%' }}>{error}</p>}
    </section>
  );
}

export function RedactToggle({ id, redact }: { id: string; redact: boolean }) {
  const router = useRouter();
  return (
    <label className="chk">
      <input type="checkbox" defaultChecked={redact} onChange={async (e) => { await updateMeetingDetails(id, { redact: e.target.checked }); router.refresh(); }} />
      Hide email addresses and phone numbers from the AI model
    </label>
  );
}
