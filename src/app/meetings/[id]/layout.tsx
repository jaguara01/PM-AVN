import Link from 'next/link';
import { listMeetingActions, listProjects } from '@/lib/db/repo';
import { fmtT, duration } from '@/lib/transcript';
import { llmFromEnv } from '@/lib/llm';
import { MeetingHeader } from '@/components/meeting-bits';
import { NavLink } from '../../nav-link';
import { loadMeeting } from './data';

export const dynamic = 'force-dynamic';

export default async function MeetingLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { db, m } = await loadMeeting(params);
  const [projects, actions] = await Promise.all([listProjects(db), listMeetingActions(db, m.id)]);
  const project = projects.find((p) => p.id === m.projectId);
  const waiting = actions.filter((a) => !a.taskId).length;
  const dur = duration(m.turns);
  const base = `/meetings/${m.id}`;
  const tabs: [string, string, number?][] = [['', 'Notes'], ['actions', 'Action items', waiting], ['whiteboard', 'Whiteboard'], ['documents', 'Documents'], ['ask', 'Ask'], ['transcript', 'Transcript']];
  return (
    <>
      <p className="crumbs"><Link href="/meetings">Meetings</Link>{project && <> / <Link href={`/projects/${project.id}/meetings`}>{project.name}</Link></>} / {m.title}</p>
      <MeetingHeader key={`${m.title}|${m.projectId}|${m.heldOn}`} id={m.id} title={m.title} projectId={m.projectId} heldOn={m.heldOn}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))} hasModel={!!llmFromEnv()} writtenByModel={m.analysis.writtenBy !== 'offline'} />
      <p className="sub">
        {m.speakers.length} speakers, {m.turns.length} lines{dur ? `, ${fmtT(dur)} long` : ''}. {m.format} transcript.{' '}
        {m.analysis.writtenBy === 'offline' ? 'Quick notes from keywords.' : `Notes written by ${m.analysis.writtenBy}.`}
        {m.external.length > 0 && <> <span className="pill warn">Outside guests: {m.external.join(', ')}</span></>}
      </p>
      <nav className="tabs" aria-label="Meeting views">
        {tabs.map(([slug, label, n]) => (
          <NavLink key={slug} className="tab" href={slug ? `${base}/${slug}` : base} exact={!slug}>{label}{n ? <em>{n}</em> : null}</NavLink>
        ))}
      </nav>
      {children}
    </>
  );
}
