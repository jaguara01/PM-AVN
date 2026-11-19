'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { askAction, clearChat, runCommandAction } from '@/app/meeting-actions';

/** Questions about the meeting. Answers are rendered on the server (as HTML) and passed in. */
export function AskPanel({ meetingId, chat, hasModel, hasProject, suggestions }: {
  meetingId: string; chat: { role: 'user' | 'assistant'; html: string }[]; hasModel: boolean; hasProject: boolean; suggestions: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'meeting' | 'project'>('meeting');
  const [asking, setAsking] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const ask = (question: string) => {
    if (!question.trim()) return;
    setAsking(question);
    setQ('');
    start(async () => {
      const r = await askAction(meetingId, question, scope);
      setError(r.ok ? '' : r.error);
      setAsking('');
      router.refresh();
    });
  };

  return (
    <section className="card c4 chat">
      <div className="bar between">
        <h2 style={{ margin: 0 }}><span className="num">2</span>Ask about this meeting</h2>
        <div className="switch" role="radiogroup" aria-label="What to search">
          <button type="button" role="radio" aria-checked={scope === 'meeting'} className={scope === 'meeting' ? 'on' : ''} onClick={() => setScope('meeting')}>This meeting</button>
          <button type="button" role="radio" aria-checked={scope === 'project'} className={scope === 'project' ? 'on' : ''} onClick={() => setScope('project')}>{hasProject ? 'Whole project' : 'All meetings'}</button>
        </div>
      </div>
      <div className="msgs" aria-live="polite">
        {chat.length === 0 && !asking && hasModel && (
          <div className="sugg">{suggestions.map((s) => <button type="button" key={s} onClick={() => ask(s)}>{s}</button>)}</div>
        )}
        {chat.map((c, i) => <div key={i} className={`msg ${c.role}`} dangerouslySetInnerHTML={{ __html: c.html }} />)}
        {asking && <><div className="msg user">{asking}</div><div className="msg assistant muted">Reading the transcript…</div></>}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <form className="bar" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <label className="sr" htmlFor="ask-q">Question</label>
        <input id="ask-q" className="grow" value={q} onChange={(e) => setQ(e.target.value)} disabled={!hasModel || pending} placeholder={hasModel ? 'Ask a question' : 'Configure a text model in .env.local to ask questions'} />
        <button className="btn solid" disabled={!hasModel || pending || !q.trim()}>Ask</button>
        {chat.length > 0 && <button type="button" className="btn quiet" onClick={() => start(async () => { await clearChat(meetingId); router.refresh(); })}>Clear</button>}
      </form>
    </section>
  );
}

export function RunCommand({ meetingId, index, hasModel }: { meetingId: string; index: number; hasModel: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="btn sm solid" disabled={!hasModel || pending} onClick={() => start(async () => { const r = await runCommandAction(meetingId, index); setError(r.ok ? '' : r.error); router.refresh(); })}>
        {pending ? 'Working…' : 'Do this now'}
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </>
  );
}
