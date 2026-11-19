import Link from 'next/link';

/** A small link to a line of the transcript. */
export function Ref({ meetingId, n }: { meetingId: string; n: number }) {
  return <Link className="ref" href={`/meetings/${meetingId}/transcript#turn-${n}`} title={`Line ${n} of the transcript`}>{n}</Link>;
}
