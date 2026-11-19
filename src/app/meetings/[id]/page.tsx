import Link from 'next/link';
import { speakerStats, fmtT } from '@/lib/transcript';
import { Avatar } from '@/components/task-bits';
import { Ref } from '@/components/ref';
import { RedactToggle } from '@/components/meeting-bits';
import { loadMeeting } from './data';

export const dynamic = 'force-dynamic';

export default async function NotesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ model?: string }> }) {
  const { m } = await loadMeeting(params);
  const { model } = await searchParams;
  const a = m.analysis;
  const list = (items: { text: string; turn: number }[], none: string) =>
    items.length ? <ul className="pts">{items.map((x, i) => <li key={i}>{x.text} <Ref meetingId={m.id} n={x.turn} /></li>)}</ul> : <p className="muted">{none}</p>;
  return (
    <>
      {model === 'failed' && <p className="tip">The AI model could not write the notes, so these are the quick notes from keywords. Use “Write notes with AI” to try again.</p>}
      <div className="cols">
        <section className="card c1">
          <h2><span className="num">1</span>Summary</h2>
          <p className="lead">{a.summary || 'No summary yet.'}</p>
          <h2>Decisions</h2>{list(a.decisions, 'No decisions found.')}
          <h2>Open questions</h2>{list(a.questions, 'No open questions found.')}
          <h2>Risks</h2>{list(a.risks, a.writtenBy === 'offline' ? 'Risks are picked up when the AI model writes the notes.' : 'No risks raised.')}
        </section>
        <div className="stack">
          <section className="card c3">
            <h2><span className="num">2</span>What was discussed</h2>
            <ol className="topics">
              {a.topics.map((t, i) => (
                <li key={i}>
                  <Link href={`/meetings/${m.id}/transcript#turn-${t.start}`}><b>{t.title}</b></Link>
                  <span className="when">{m.turns[t.start]?.t != null ? fmtT(m.turns[t.start].t) : `line ${t.start}`}</span>
                  {t.summary && <p>{t.summary}</p>}
                </li>
              ))}
            </ol>
          </section>
          <section className="card c4">
            <h2><span className="num">3</span>Who spoke</h2>
            {speakerStats(m.turns).map((s) => (
              <div className="talk" key={s.name}>
                <Avatar name={s.name} /><span>{s.name}</span>
                <div className="meter"><i className="p-domains" style={{ width: `${s.pct}%` }} /></div><b>{s.pct}%</b>
              </div>
            ))}
            <h2>Privacy</h2>
            <RedactToggle id={m.id} redact={m.redact} />
            <div className="bar"><a className="btn sm" href={`/meetings/${m.id}/export?format=md`}>Download notes</a></div>
          </section>
        </div>
      </div>
    </>
  );
}
