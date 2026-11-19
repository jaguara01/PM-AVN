import { listDocuments } from '@/lib/db/repo';
import { llmFromEnv } from '@/lib/llm';
import { MEETING_TEMPLATES } from '@/lib/meetings/prompts';
import { DocWriter } from '@/components/doc-writer';
import { DocList } from '@/components/doc-list';
import { loadMeeting } from '../data';

export const dynamic = 'force-dynamic';

export default async function MeetingDocsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string }> }) {
  const { db, m, lineHref } = await loadMeeting(params);
  const { doc } = await searchParams;
  const docs = await listDocuments(db, { meetingId: m.id });
  return (
    <div className="cols docs">
      <DocWriter target={{ kind: 'meeting', meetingId: m.id }} templates={Object.entries(MEETING_TEMPLATES).map(([k, v]) => [k, v[0]])} modelName={llmFromEnv()?.name ?? null} />
      <DocList docs={docs} selected={doc} lineHref={lineHref} emptyText="Documents you write from this meeting appear here. Numbers in boxes link to the transcript line they came from." />
    </div>
  );
}
