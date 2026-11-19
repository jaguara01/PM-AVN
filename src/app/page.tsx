import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { listAllTasks, listMeetings, listPeople, listProjects } from '@/lib/db/repo';
import { addDays, dayOfMonth, dueLabel, fmtDay, fmtWeekday, hourNow, todayIso, weekday } from '@/lib/dates';
import { COLORS } from '@/lib/colors';
import { isLate } from '@/lib/tasks';
import { taskSources } from '@/lib/services/sources';
import { TaskButton, TaskPanelProvider } from '@/components/task-panel';
import { WeekChip } from '@/components/task-row';
import { Avatar } from '@/components/task-bits';
import { loadExampleProjects } from './actions';
import { Icon } from './icons';

export const dynamic = 'force-dynamic';

const FLOW: [string, string][] = [
  ['Plan', 'Projects, owners and dates on one board, so everyone sees what is next.'],
  ['Meet', 'Drop in a transcript from any tool. Notes, decisions and action items come out.'],
  ['Deliver', 'Move tasks to done on the board and timeline, and keep dates honest.'],
  ['Report', 'Write status updates and plans from the tasks and meeting notes.'],
];

function Arrow() {
  return <svg className="go" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 10h11M11 5.5l4.5 4.5-4.5 4.5" /></svg>;
}

export default async function Home() {
  const db = await getDb();
  const today = todayIso();
  const [projects, tasks, meetings, people] = await Promise.all([listProjects(db), listAllTasks(db), listMeetings(db), listPeople(db)]);
  const color = (pid: string) => COLORS[(projects.find((p) => p.id === pid)?.color ?? 6) % COLORS.length];
  const open = tasks.filter((t) => t.status !== 'done');
  const late = open.filter((t) => isLate(t, today)).sort((a, b) => (a.due! < b.due! ? -1 : 1));
  const week = open.filter((t) => t.due && t.due >= today && t.due <= addDays(today, 6)).sort((a, b) => (a.due! < b.due! ? -1 : 1));
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const toReview = meetings.reduce((n, m) => n + m.toReview, 0);
  const firstToReview = meetings.find((m) => m.toReview > 0);
  const h = hourNow();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

  if (!projects.length) {
    return (
      <>
        <section className="hero"><h1>{greet}: let’s set up your first project</h1>
          <p className="welcome">Welcome to PM-AVN, the element61 project workspace.</p></section>
        <div className="empty">
          <b>No projects yet</b>
          <p className="muted">Create a project from the portfolio, import a meeting transcript, or load six example projects to look around.</p>
          <div className="bar"><Link className="btn solid" href="/portfolio#add-project">Create a project</Link><Link className="btn" href="/meetings">Import a transcript</Link>
            <form action={loadExampleProjects}><button className="btn">Load example projects</button></form></div>
        </div>
      </>
    );
  }

  return (
    <TaskPanelProvider data={{ tasks, people, projects: projects.map((p) => ({ id: p.id, name: p.name })), sources: await taskSources(db, tasks), today }}>
      <section className="hero">
        <h1>{greet}: here is your week across every project</h1>
        <p className="welcome">Welcome to PM-AVN, the element61 project workspace.</p>
        <p className="sub">
          {week.length} {week.length === 1 ? 'task is' : 'tasks are'} due in the next seven days{late.length > 0 && <>, and <b className="late">{late.length} {late.length === 1 ? 'is' : 'are'} late</b></>}.
          {toReview > 0 && ` ${toReview} action ${toReview === 1 ? 'item from a meeting is' : 'items from meetings are'} waiting for review.`}
        </p>
      </section>

      <section aria-labelledby="flow">
        <p className="eyebrow" id="flow">Your project flow</p>
        <ol className="steps">
          {FLOW.map(([t, d], i) => <li key={t} className={`step c${i + 1}`}><span className="num">{i + 1}</span><b>{t}</b><span className="sd">{d}</span></li>)}
        </ol>
      </section>

      <section aria-labelledby="week">
        <p className="eyebrow" id="week">Next seven days</p>
        <div className="week">
          {days.map((d, i) => (
            <div key={d} className={`day ${i === 0 ? 'now' : ''} ${[0, 6].includes(weekday(d)) ? 'wkd' : ''}`}>
              <div className="dh"><span>{i === 0 ? 'Today' : fmtWeekday(d)}</span><b>{dayOfMonth(d)}</b></div>
              {week.filter((t) => t.due === d).map((t) => <WeekChip key={t.id} task={t} color={color(t.projectId)} />)}
            </div>
          ))}
        </div>
      </section>

      <div className="stepcards">
        <section className="card c1">
          <h2><span className="num">1</span>Plan: your projects</h2>
          {projects.map((p) => {
            const ts = tasks.filter((t) => t.projectId === p.id);
            const nl = ts.filter((t) => isLate(t, today)).length;
            return (
              <Link key={p.id} className="srow" href={`/projects/${p.id}`}>
                <i className="dot" style={{ background: color(p.id) }} /><span className="sl">{p.name}</span>
                {nl > 0 && <span className="pill warn">{nl} late</span>}
                <span className="sm">{ts.filter((t) => t.status === 'done').length} of {ts.length} done</span><Arrow />
              </Link>
            );
          })}
          <Link className="srow add" href="/portfolio#add-project"><Icon name="plus" size={16} /><span className="sl">Start a new project</span><Arrow /></Link>
        </section>

        <section className="card c2">
          <h2><span className="num">2</span>Meet: recent meetings</h2>
          {meetings.slice(0, 5).map((m) => (
            <Link key={m.id} className="srow" href={`/meetings/${m.id}${m.toReview ? '/actions' : ''}`}>
              <Icon name="meetings" size={16} /><span className="sl">{m.title}</span>
              {m.toReview > 0 && <span className="pill sig">{m.toReview} to review</span>}
              <span className="sm">{m.heldOn ? fmtDay(m.heldOn) : ''}</span><Arrow />
            </Link>
          ))}
          <Link className="srow add" href="/meetings"><Icon name="plus" size={16} /><span className="sl">Import a transcript from Teams, Zoom or Meet</span><Arrow /></Link>
        </section>

        <section className="card c3">
          <h2><span className="num">3</span>Deliver: late and due this week</h2>
          {[...late, ...week].slice(0, 7).map((t) => (
            <TaskButton key={t.id} id={t.id} className="srow">
              <i className="dot" style={{ background: color(t.projectId) }} /><span className="sl">{t.title}</span>
              <Avatar name={t.owner} /><span className={`sm ${isLate(t, today) ? 'late' : ''}`}>{dueLabel(t.due, today)}</span><Arrow />
            </TaskButton>
          ))}
          {late.length + week.length === 0 && <p className="muted">Nothing is due this week.</p>}
          <Link className="srow add" href="/my-work"><Icon name="me" size={16} /><span className="sl">See everything assigned to me</span><Arrow /></Link>
        </section>

        <section className="card c4">
          <h2><span className="num">4</span>Report: keep people informed</h2>
          {projects.slice(0, 5).map((p) => (
            <Link key={p.id} className="srow" href={`/projects/${p.id}/documents?tpl=status`}>
              <Icon name="doc" size={16} /><span className="sl">Status update for {p.name}</span><span className="sm">Write with AI</span><Arrow />
            </Link>
          ))}
          <Link className="srow add" href="/portfolio"><Icon name="portfolio" size={16} /><span className="sl">See which projects are alike</span><Arrow /></Link>
        </section>
      </div>

      {firstToReview && (
        <aside className="tip">
          <Icon name="bulb" size={22} />
          <span>{toReview} action {toReview === 1 ? 'item' : 'items'} from <b>{firstToReview.title}</b>{meetings.filter((m) => m.toReview).length > 1 ? ' and other meetings' : ''} {toReview === 1 ? 'is' : 'are'} waiting to go on a board.</span>
          <Link className="btn sm solid" href={`/meetings/${firstToReview.id}/actions`}>Review</Link>
        </aside>
      )}
    </TaskPanelProvider>
  );
}
