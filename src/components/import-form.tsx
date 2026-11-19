'use client';

import { useActionState, useRef, useState } from 'react';
import { importMeetingAction } from '@/app/meeting-actions';

export function ImportForm({ projects, projectId, today, modelName }: { projects: { id: string; name: string }[]; projectId?: string; today: string; modelName: string | null }) {
  const [state, action, pending] = useActionState(importMeetingAction, null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  }

  return (
    <form action={action} className="card c2 import">
      <h2><span className="num">1</span>Import a transcript</h2>
      <div className={`drop ${over ? 'on' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]); }}>
        Drop a .txt, .vtt, .srt, .json or .md file here, or{' '}
        <button type="button" className="linkbtn" onClick={() => fileRef.current?.click()}>choose a file</button>
        <input ref={fileRef} type="file" accept=".txt,.vtt,.srt,.json,.md,text/*" hidden onChange={(e) => load(e.target.files?.[0])} />
      </div>
      <label htmlFor="imp-text" className="sr">Transcript</label>
      <textarea id="imp-text" name="text" rows={8} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Or paste the transcript. Zoom, Teams, Google Meet, Otter, Fireflies, WebVTT, SRT, JSON and plain text all work." />
      <div className="fgrid">
        <label>Title<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Named for you if left empty" /></label>
        <label>Project
          <select name="projectId" defaultValue={projectId ?? ''}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Meeting date<input type="date" name="heldOn" defaultValue={today} /></label>
        <label>Your email domains<input name="domains" placeholder="element61.be" /></label>
      </div>
      <label className="chk"><input type="checkbox" name="redact" defaultChecked />Hide email addresses and phone numbers from the AI model</label>
      {state && !state.ok && <p className="err" role="alert">{state.error}</p>}
      <div className="bar">
        <button className="btn solid" disabled={pending || !text.trim()}>{pending ? (modelName ? 'Reading the transcript…' : 'Importing…') : 'Create meeting notes'}</button>
        <span className="muted small">{modelName ? `Notes are written by ${modelName}.` : 'No text model is configured: quick notes are made from keywords.'}</span>
      </div>
    </form>
  );
}
