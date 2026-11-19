import { getTask, listMeetingActions, listPeople, listProjects } from '@/lib/db/repo';
import { ActionItems } from '@/components/action-items';
import type { Status } from '@/lib/tasks';
import { loadMeeting } from '../data';

export const dynamic = 'force-dynamic';

export default async function ActionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, m } = await loadMeeting(params);
  const [items, people, projects] = await Promise.all([listMeetingActions(db, m.id), listPeople(db), listProjects(db)]);
  const tasks = await Promise.all(items.filter((a) => a.taskId).map((a) => getTask(db, a.taskId!)));
  const taskStatus: Record<string, { status: Status; title: string; owner: string; due: string | null }> = {};
  for (const t of tasks) if (t) taskStatus[t.id] = { status: t.status, title: t.title, owner: t.owner, due: t.due };
  const project = projects.find((p) => p.id === m.projectId);
  return <ActionItems meetingId={m.id} items={items} projectId={project?.id ?? null} projectName={project?.name ?? null} people={people} taskStatus={taskStatus} />;
}
