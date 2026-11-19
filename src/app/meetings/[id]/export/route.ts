import { getDb } from '@/lib/db/client';
import { getMeeting, listMeetingActions } from '@/lib/db/repo';
import { fmtT } from '@/lib/transcript';

export const dynamic = 'force-dynamic';

const fileName = (s: string) => s.replace(/[^\w\- ]+/g, '').trim() || 'meeting';

/** GET ?format=md for the notes, ?format=txt for the transcript. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const m = await getMeeting(db, id);
  if (!m) return new Response('No such meeting.', { status: 404 });
  const format = new URL(req.url).searchParams.get('format') === 'txt' ? 'txt' : 'md';
  let body: string;
  if (format === 'txt') body = m.turns.map((t) => `${t.t !== null ? `[${fmtT(t.t)}] ` : ''}${t.spk}: ${t.text}`).join('\n');
  else {
    const a = m.analysis;
    const actions = await listMeetingActions(db, id);
    const items = (xs: { text: string }[]) => xs.map((x) => `- ${x.text}`).join('\n') || '- none';
    body = `# ${m.title}\n${m.heldOn ?? ''}\n\n## Summary\n${a.summary}\n\n## Decisions\n${items(a.decisions)}\n\n## Action items\n${actions.map((x) => `- [${x.taskId ? 'x' : ' '}] ${x.task} (${x.owner}${x.due ? `, ${x.due}` : x.dueSaid ? `, ${x.dueSaid}` : ''})`).join('\n') || '- none'}\n\n## Open questions\n${items(a.questions)}\n\n## Risks\n${items(a.risks)}\n`;
  }
  return new Response(body, {
    headers: { 'content-type': `text/${format === 'md' ? 'markdown' : 'plain'}; charset=utf-8`, 'content-disposition': `attachment; filename="${fileName(m.title)}${format === 'txt' ? ' transcript' : ' notes'}.${format}"` },
  });
}
