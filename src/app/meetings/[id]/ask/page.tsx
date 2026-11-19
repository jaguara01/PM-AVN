import { llmFromEnv } from '@/lib/llm';
import { renderMarkdown } from '@/lib/markdown';
import { AskPanel, RunCommand } from '@/components/ask-panel';
import { CopyButton } from '@/components/doc-writer';
import { Ref } from '@/components/ref';
import { loadMeeting } from '../data';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default async function AskPage({ params }: { params: Promise<{ id: string }> }) {
  const { m, lineHref } = await loadMeeting(params);
  const hasModel = !!llmFromEnv();
  const cmds = m.analysis.commands;
  return (
    <div className="cols docs">
      <section className="card c3">
        <h2><span className="num">1</span>Asked of {m.wake} during the call</h2>
        {cmds.length === 0 && <p className="muted">When someone says “{m.wake}, start a doc for this plan”, the request shows up here so it can be done after the call.</p>}
        {cmds.map((c, i) => (
          <div className="cmd" key={i}>
            <p className="who"><b>{c.speaker}</b> <Ref meetingId={m.id} n={c.turn} /></p>
            <blockquote>{c.request}</blockquote>
            {c.result ? (
              <>
                <div className="doc" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.result, lineHref) }} />
                <div className="bar"><CopyButton text={c.result} /></div>
              </>
            ) : <RunCommand meetingId={m.id} index={i} hasModel={hasModel} />}
          </div>
        ))}
        {cmds.length > 0 && <p className="muted small">Each request only sees the transcript up to the moment it was spoken.</p>}
      </section>
      <AskPanel meetingId={m.id} hasModel={hasModel} hasProject={!!m.projectId}
        chat={m.chat.map((c) => ({ role: c.role, html: c.role === 'user' ? esc(c.content) : renderMarkdown(c.content, lineHref) }))}
        suggestions={['What did we decide, and who disagreed?', 'What did each person commit to?', 'What is still unresolved?']} />
    </div>
  );
}
