'use client';

import { useRef, useState } from 'react';
import { saveWhiteboard } from '@/app/meeting-actions';
import type { BoardNode } from '@/lib/db/repo';

/** Sticky notes grouped by topic. Drag to rearrange; layout is saved for everyone. */
export function Whiteboard({ meetingId, nodes: initial }: { meetingId: string; nodes: BoardNode[] }) {
  const [nodes, setNodes] = useState(initial);
  const [saved, setSaved] = useState(true);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const width = Math.max(900, ...nodes.map((n) => n.x + 270));
  const height = Math.max(480, ...nodes.map((n) => n.y + 140));

  async function persist(next: BoardNode[] | null) {
    setSaved(false);
    await saveWhiteboard(meetingId, next);
    setSaved(true);
  }

  return (
    <section>
      <div className="bar between">
        <p className="legend"><i className="k-decision" />Decision<i className="k-action" />Action<i className="k-question" />Question<i className="k-risk" />Risk<i className="k-note" />Note</p>
        <div className="bar">
          <span className="muted small" aria-live="polite">{saved ? 'Saved' : 'Saving…'}</span>
          <button type="button" className="btn sm" onClick={() => { const next = [...nodes, { id: `note-${Date.now()}`, kind: 'note' as const, text: 'New note', x: 30, y: 30 }]; setNodes(next); persist(next); }}>Add a note</button>
          <button type="button" className="btn sm" onClick={() => { persist(null).then(() => location.reload()); }}>Reset layout</button>
        </div>
      </div>
      <div className="wbwrap">
        <div className="wb" style={{ width, height }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            setNodes((ns) => ns.map((n) => (n.id === d.id ? { ...n, x: Math.max(0, d.ox + e.clientX - d.sx), y: Math.max(0, d.oy + e.clientY - d.sy) } : n)));
          }}
          onPointerUp={() => { if (drag.current) { drag.current = null; persist(nodes); } }}>
          {nodes.map((n) => (
            <div key={n.id} className={`sticky k-${n.kind}`} style={{ left: n.x, top: n.y }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).isContentEditable) return;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
              }}>
              <div className="nt" contentEditable={n.kind === 'note'} suppressContentEditableWarning
                onBlur={(e) => { const text = e.currentTarget.textContent ?? ''; if (text !== n.text) { const next = nodes.map((x) => (x.id === n.id ? { ...x, text } : x)); setNodes(next); persist(next); } }}>{n.text}</div>
              {n.kind === 'action' && n.owner && <div className="no">{n.owner}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
