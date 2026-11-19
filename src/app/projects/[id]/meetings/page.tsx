import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { listMeetings } from '@/lib/db/repo';
import { MeetingRow } from '@/components/meeting-row';

export const dynamic = 'force-dynamic';

export default async function ProjectMeetingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meetings = await listMeetings(await getDb(), { projectId: id });
  return (
    <section className="card c2">
      <div className="bar between">
        <h2 style={{ margin: 0 }}><span className="num">1</span>Meetings in this project</h2>
        <Link className="btn solid" href={`/meetings?project=${id}`}>Import a transcript</Link>
      </div>
      {meetings.length === 0 ? <p className="muted">No meetings yet. Import a transcript and its action items can go straight to this board.</p> : (
        <div className="rows" style={{ marginTop: 12 }}>{meetings.map((m) => <MeetingRow key={m.id} m={m} />)}</div>
      )}
    </section>
  );
}
