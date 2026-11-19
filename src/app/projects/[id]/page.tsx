import { getDb } from '@/lib/db/client';
import { listPeople, listProjects, listTasks } from '@/lib/db/repo';
import { todayIso } from '@/lib/dates';
import { Board } from '@/components/board';
import { TaskPanelProvider } from '@/components/task-panel';
import { taskSources } from '@/lib/services/sources';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ owner?: string }> }) {
  const { id } = await params;
  const { owner } = await searchParams;
  const db = await getDb();
  const [tasks, people, projects] = await Promise.all([listTasks(db, id), listPeople(db), listProjects(db)]);
  const owners = [...new Set(tasks.map((t) => t.owner))].sort();
  return (
    <TaskPanelProvider data={{ tasks, people, projects: projects.map((p) => ({ id: p.id, name: p.name })), sources: await taskSources(db, tasks), today: todayIso() }}>
      <form className="bar filter" method="get">
        <label className="inl">Owner
          <select name="owner" defaultValue={owner ?? ''}>
            <option value="">Everyone</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <button className="btn sm">Show</button>
        <span className="muted small">Drag cards between columns, or open a card to change its status.</span>
      </form>
      <Board projectId={id} ownerFilter={owner || undefined} />
    </TaskPanelProvider>
  );
}
