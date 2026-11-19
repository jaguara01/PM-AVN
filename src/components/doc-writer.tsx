'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteDocumentAction, writeDocumentAction } from '@/app/meeting-actions';
import type { MeetingTemplate, ProjectTemplate } from '@/lib/meetings/prompts';

type Target = { kind: 'meeting'; meetingId: string } | { kind: 'project'; projectId: string };

export function DocWriter({ target, templates, modelName, initial }: { target: Target; templates: [string, string][]; modelName: string | null; initial?: string }) {
  const router = useRouter();
  const [tpl, setTpl] = useState(templates.some(([k]) => k === initial) ? initial! : templates[0][0]);
  const [extra, setExtra] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <section className="card c2">
      <h2><span className="num">1</span>Write a document</h2>
      <div className="tpls" role="radiogroup" aria-label="Document type">
        {templates.map(([k, name]) => <button type="button" key={k} role="radio" aria-checked={tpl === k} className={tpl === k ? 'on' : ''} onClick={() => setTpl(k)}>{name}</button>)}
      </div>
      <label>{tpl === 'custom' ? 'Describe the document' : 'Anything to add? Audience, tone, language'}
        <textarea rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="bar">
        <button type="button" className="btn solid" disabled={!modelName || pending} onClick={() => start(async () => {
          const r = target.kind === 'meeting'
            ? await writeDocumentAction({ meetingId: target.meetingId, template: tpl as MeetingTemplate }, extra)
            : await writeDocumentAction({ projectId: target.projectId, template: tpl as ProjectTemplate }, extra);
          if (!r.ok) return setError(r.error);
          setError('');
          router.push(`?doc=${r.value}`);
          router.refresh();
        })}>{pending ? 'Writing…' : 'Write with AI'}</button>
        <span className="muted small">{modelName ? `Written by ${modelName}. Check it before you send it.` : 'Configure a text model in .env.local to write documents.'}</span>
      </div>
    </section>
  );
}

export function DeleteDocument({ id }: { id: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  return <button type="button" className="btn sm quiet" onBlur={() => setArmed(false)} onClick={async () => { if (!armed) return setArmed(true); await deleteDocumentAction(id); router.push('?'); router.refresh(); }}>{armed ? 'Click again to delete' : 'Delete'}</button>;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>{copied ? 'Copied' : 'Copy'}</button>;
}
