import { getDb } from '@/lib/db/client';
import { listPeople, listProjects, listTasks } from '@/lib/db/repo';
import { dayOfMonth, fmtDay, fmtMonth, todayIso, weekday } from '@/lib/dates';
import { buildTimeline } from '@/lib/timeline';
import { isLate } from '@/lib/tasks';
import { taskSources } from '@/lib/services/sources';
import { TaskButton, TaskPanelProvider } from '@/components/task-panel';
import { Avatar, StatusIcon } from '@/components/task-bits';

export const dynamic = 'force-dynamic';
const W = 28;

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const today = todayIso();
  const [tasks, people, projects] = await Promise.all([listTasks(db, id), listPeople(db), listProjects(db)]);
  const tl = buildTimeline(tasks, today);
  return (
    <TaskPanelProvider data={{ tasks, people, projects: projects.map((p) => ({ id: p.id, name: p.name })), sources: await taskSources(db, tasks), today }}>
      {tl.bars.length === 0 ? (
        <p className="muted">Tasks appear here once they have a due date.</p>
      ) : (
        <div className="tl" style={{ ['--w' as string]: `${W}px`, ['--n' as string]: tl.days.length }}>
          <div className="tl-in">
            <div className="tl-head">
              <div className="tl-lab" />
              <div className="tl-days">
                {tl.days.map((d, i) => (
                  <span key={d} className={`${[0, 6].includes(weekday(d)) ? 'wkd' : ''} ${d === today ? 'now' : ''}`}>
                    {(dayOfMonth(d) === 1 || i === 0) && <b>{fmtMonth(d)}</b>}{dayOfMonth(d)}
                  </span>
                ))}
              </div>
            </div>
            {tl.bars.map(({ task: t, from, span }) => (
              <div className="tl-row" key={t.id}>
                <TaskButton id={t.id} className="tl-lab"><StatusIcon status={t.status} /><span>{t.title}</span></TaskButton>
                <div className="tl-track">
                  <TaskButton id={t.id} className={`tl-bar s-${t.status} ${isLate(t, today) ? 'late' : ''}`} style={{ left: from * W, width: span * W - 4 }} title={`${t.title}, due ${fmtDay(t.due!)}`}>
                    <Avatar name={t.owner} size="xs" /><span>{t.owner === 'Unassigned' ? '' : t.owner.split(' ')[0]}</span>
                  </TaskButton>
                </div>
              </div>
            ))}
            {tl.todayIndex !== null && <i className="tl-now" style={{ left: `calc(var(--lab) + ${tl.todayIndex * W + W / 2}px)` }} />}
          </div>
        </div>
      )}
      {tl.undated > 0 && <p className="muted small">{tl.undated} {tl.undated === 1 ? 'task has' : 'tasks have'} no due date and {tl.undated === 1 ? 'is' : 'are'} not shown.</p>}
    </TaskPanelProvider>
  );
}
