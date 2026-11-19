import Link from 'next/link';
import type { DocumentRow } from '@/lib/db/repo';
import { renderMarkdown } from '@/lib/markdown';
import { CopyButton, DeleteDocument } from './doc-writer';

/** Saved documents on the left, the selected one on the right. Selection is in the URL (?doc=), so it can be shared. */
export function DocList({ docs, selected, lineHref, emptyText }: { docs: DocumentRow[]; selected?: string; lineHref?: (n: number) => string; emptyText: string }) {
  const doc = docs.find((d) => d.id === selected) ?? docs[0];
  return (
    <section className="paper">
      {docs.length > 1 && (
        <nav className="doctabs" aria-label="Saved documents">
          {docs.map((d) => <Link key={d.id} href={`?doc=${d.id}`} aria-current={d.id === doc?.id ? 'page' : undefined}>{d.name}<span>{d.createdAt}</span></Link>)}
        </nav>
      )}
      {doc ? (
        <>
          <div className="bar between">
            <p className="muted small">{doc.name}, written by {doc.writtenBy} on {doc.createdAt}</p>
            <div className="bar"><CopyButton text={doc.body} /><DeleteDocument id={doc.id} /></div>
          </div>
          <div className="doc" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.body, lineHref) }} />
        </>
      ) : <p className="muted">{emptyText}</p>}
    </section>
  );
}
