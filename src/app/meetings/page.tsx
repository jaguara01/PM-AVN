import { getDb } from '@/lib/db/client';
import { listMeetings, listProjects } from '@/lib/db/repo';
import { todayIso } from '@/lib/dates';
import { MeetingRow } from '@/components/meeting-row';
import { llmFromEnv } from '@/lib/llm';
import { ImportForm } from '@/components/import-form';

export const dynamic = 'force-dynamic';

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const db = await getDb();
  const [meetings, projects] = await Promise.all([listMeetings(db), listProjects(db)]);
  const name = (id: string | null) => projects.find((p) => p.id === id)?.name;
  return (
    <>
      <section className="top">
        <div>
          <h1>Meetings</h1>
          <p className="welcome">Turn any transcript into the work that follows.</p>
          <p className="sub">Import a transcript to get notes, decisions and action items, then send the action items to a project board.</p>
        </div>
      </section>
      <div className="cols">
        <ImportForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} projectId={project} today={todayIso()} modelName={llmFromEnv()?.name ?? null} />
        <section className="card c4">
          <h2><span className="num">2</span>All meetings <span className="muted" style={{ fontWeight: 600 }}>{meetings.length}</span></h2>
          {meetings.length === 0 && <p className="muted">Imported meetings are listed here.</p>}
          <div className="rows">
            {meetings.map((m) => <MeetingRow key={m.id} m={m} projectName={name(m.projectId)} />)}
          </div>
        </section>
      </div>
    </>
  );
}
