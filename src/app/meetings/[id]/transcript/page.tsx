import { fmtT } from '@/lib/transcript';
import { loadMeeting } from '../data';

export const dynamic = 'force-dynamic';

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);

function highlight(text: string, q: string) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

export default async function TranscriptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; speaker?: string }> }) {
  const { m } = await loadMeeting(params);
  const { q = '', speaker = '' } = await searchParams;
  const ql = q.trim().toLowerCase();
  const rows = m.turns.filter((t) => (!speaker || t.spk === speaker) && (!ql || `${t.spk} ${t.text}`.toLowerCase().includes(ql)));
  return (
    <section className="card">
      <form className="bar" method="get">
        <label className="sr" htmlFor="tq">Search the transcript</label>
        <input id="tq" name="q" type="search" defaultValue={q} placeholder="Search the transcript" style={{ maxWidth: 360 }} />
        <label className="sr" htmlFor="tsp">Speaker</label>
        <select id="tsp" name="speaker" defaultValue={speaker}>
          <option value="">All speakers</option>
          {m.speakers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn sm">Search</button>
        <span className="grow" />
        <a className="btn sm" href={`/meetings/${m.id}/export?format=txt`}>Download</a>
      </form>
      <div className="tx">
        {rows.length === 0 && <p className="muted">No lines match.</p>}
        {rows.map((t) => (
          <div className="turn" id={`turn-${t.i}`} key={t.i}>
            <span className="tn">{t.i}</span>
            <span className="when">{t.t !== null ? fmtT(t.t) : ''}</span>
            <div><b className="spk" style={{ ['--h' as string]: hue(t.spk) }}>{t.spk}</b><p>{highlight(t.text, q.trim())}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
