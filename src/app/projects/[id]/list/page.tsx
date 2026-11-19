import { getDb } from '@/lib/db/client';
import { listPeople, listProjects, listTasks } from '@/lib/db/repo';
import { todayIso } from '@/lib/dates';
import { sortTasks, type SortKey } from '@/lib/timeline';
import { taskSources } from '@/lib/services/sources';
import { TaskList } from '@/components/task-list';
import { TaskPanelProvider } from '@/components/task-panel';

export const dynamic = 'force-dynamic';
const KEYS: SortKey[] = ['status', 'title', 'owner', 'due', 'priority'];

export default async function ListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string; dir?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const sort = KEYS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : 'status';
  const dir = sp.dir === 'desc' ? -1 : 1;
  const db = await getDb();
  const [tasks, people, projects] = await Promise.all([listTasks(db, id), listPeople(db), listProjects(db)]);
  const sorted = sortTasks(tasks, sort, dir);
  return (
    <TaskPanelProvider data={{ tasks, people, projects: projects.map((p) => ({ id: p.id, name: p.name })), sources: await taskSources(db, tasks), today: todayIso() }}>
      <section className="card"><TaskList tasks={sorted} sort={sort} dir={dir} /></section>
    </TaskPanelProvider>
  );
}
