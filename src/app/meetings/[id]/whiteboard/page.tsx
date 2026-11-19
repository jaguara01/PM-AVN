import { layoutWhiteboard } from '@/lib/services/meetings';
import { Whiteboard } from '@/components/whiteboard';
import { loadMeeting } from '../data';

export const dynamic = 'force-dynamic';

export default async function WhiteboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, m } = await loadMeeting(params);
  const nodes = m.board ?? (await layoutWhiteboard(db, m));
  return <Whiteboard key={nodes.length} meetingId={m.id} nodes={nodes} />;
}
