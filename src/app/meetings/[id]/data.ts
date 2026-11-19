import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getMeeting } from '@/lib/db/repo';

/** Loads the meeting for a page under /meetings/[id], or shows the not-found page. */
export async function loadMeeting(params: Promise<{ id: string }>) {
  const { id } = await params;
  const db = await getDb();
  const m = await getMeeting(db, id);
  if (!m) notFound();
  return { db, m, lineHref: (n: number) => `/meetings/${m.id}/transcript#turn-${n}` };
}
