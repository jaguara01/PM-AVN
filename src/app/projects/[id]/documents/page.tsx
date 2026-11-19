import { getDb } from '@/lib/db/client';
import { listDocuments } from '@/lib/db/repo';
import { llmFromEnv } from '@/lib/llm';
import { PROJECT_TEMPLATES } from '@/lib/meetings/prompts';
import { DocWriter } from '@/components/doc-writer';
import { DocList } from '@/components/doc-list';

export const dynamic = 'force-dynamic';

export default async function ProjectDocsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string; tpl?: string }> }) {
  const { id } = await params;
  const { doc, tpl } = await searchParams;
  const docs = await listDocuments(await getDb(), { projectId: id });
  return (
    <div className="cols docs">
      <DocWriter target={{ kind: 'project', projectId: id }} initial={tpl} templates={Object.entries(PROJECT_TEMPLATES).map(([k, v]) => [k, v[0]])} modelName={llmFromEnv()?.name ?? null} />
      <DocList docs={docs} selected={doc} emptyText="Documents written from this project’s tasks, dates and meeting notes appear here." />
    </div>
  );
}
