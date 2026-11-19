import Link from 'next/link';
import { fmtDay } from '@/lib/dates';

export function MeetingRow({ m, projectName }: { m: { id: string; title: string; heldOn: string | null; toReview: number; onBoard: number }; projectName?: string }) {
  return (
    <Link className="row mrow" href={`/meetings/${m.id}${m.toReview ? '/actions' : ''}`}>
      <span className="grow"><b>{m.title}</b><p>{m.heldOn ? fmtDay(m.heldOn) : 'No date'}{projectName ? `, ${projectName}` : ''}</p></span>
      {m.toReview ? <span className="pill sig">{m.toReview} to review</span> : <span className="pill">{m.onBoard} on the board</span>}
    </Link>
  );
}
