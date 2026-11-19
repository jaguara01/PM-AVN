import Link from 'next/link';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db/client';
import { listAllTasks, listOpenActionsFor, listPeople, listProjects } from '@/lib/db/repo';
import { addDays, todayIso } from '@/lib/dates';
import { COLORS } from '@/lib/colors';
import { isLate, type Task } from '@/lib/tasks';
import { taskSources } from '@/lib/services/sources';
import { TaskPanelProvider } from '@/components/task-panel';
import { TaskRow } from '@/components/task-row';
import { choosePerson } from '../actions';

export const dynamic = 'force-dynamic';

export default async function MyWork({ searchParams }: { searchParams: Promise<{ person?: string; done?: string }> }) {
  const sp = await searchParams;
  const me = sp.person ?? (await cookies()).get('pmavn_person')?.value ?? '';
  const db = await getDb();
  const today = todayIso();
  const [people, projects, mine, actions] = await Promise.all([listPeople(db), listProjects(db), me ? listAllTasks(db, { owner: me }) : Promise.resolve([] as Task[]), me ? listOpenActionsFor(db, me) : Promise.resolve([])]);
  const project = (id: string) => projects.find((p) => p.id === id);
  const open = mine.filter((t) => t.status !== 'done');
  const groups: [string, Task[]][] = [
    ['Late', open.filter((t) => isLate(t, today))],
    ['Next seven days', open.filter((t) => t.due && t.due >= today && t.due <= addDays(today, 6))],
    ['Later', open.filter((t) => t.due && t.due > addDays(today, 6))],
    ['No date', open.filter((t) => !t.due)],
  ];
  const done = mine.filter((t) => t.status === 'done');
  return (
    <TaskPanelProvider data={{ tasks: mine, people, projects: projects.map((p) => ({ id: p.id, name: p.name })), sources: await taskSources(db, mine), today }}>
      <section className="top">
        <div>
          <h1>My work</h1>
          <p className="sub">Open tasks assigned to one person, across every project.</p>
        </div>
        <form action={choosePerson} className="bar">
          <label className="inl">Show tasks for
            <select name="person" defaultValue={me}>
              <option value="">Choose a person</option>
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <button className="btn sm">Show</button>
        </form>
      </section>
      {!me ? (
        <div className="empty"><b>Choose who you are</b><p className="muted">Pick your name above and this page lists what is on your plate. This browser remembers the choice.</p></div>
      ) : (
        <>
          {actions.length > 0 && (
            <section className="card c2" style={{ marginTop: 24 }}>
              <h2><span className="num">{actions.length}</span>Promised in meetings, not on a board yet</h2>
              {actions.map((a) => (
                <Link key={a.id} className="srow" href={`/meetings/${a.meetingId}/actions`}>
                  <span className="sl">{a.task}</span><span className="sm">{a.meetingTitle}</span>
                </Link>
              ))}
            </section>
          )}
          {open.length === 0 && <div className="empty" style={{ marginTop: 24 }}><b>Nothing open</b><p className="muted">{me} has no open tasks.</p></div>}
          {groups.filter(([, ts]) => ts.length).map(([name, ts]) => (
            <section key={name}>
              <h2>{name} <span className="muted" style={{ fontWeight: 600 }}>{ts.length}</span></h2>
              <div className="rows">{ts.map((t) => <TaskRow key={t.id} task={t} projectName={project(t.projectId)?.name} projectColor={COLORS[(project(t.projectId)?.color ?? 6) % COLORS.length]} />)}</div>
            </section>
          ))}
          {done.length > 0 && (
            <details className="donebox">
              <summary>Done <span className="muted">{done.length}</span></summary>
              <div className="rows">{done.map((t) => <TaskRow key={t.id} task={t} projectName={project(t.projectId)?.name} projectColor={COLORS[(project(t.projectId)?.color ?? 6) % COLORS.length]} />)}</div>
            </details>
          )}
        </>
      )}
    </TaskPanelProvider>
  );
}
