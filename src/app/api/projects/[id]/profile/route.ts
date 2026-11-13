import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getProfile, getProject } from '@/lib/db/repo';
import { refreshProfile } from '@/lib/services/profiles';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const stored = await getProfile(await getDb(), id);
  if (!stored) return NextResponse.json({ error: `No profile for project "${id}".` }, { status: 404 });
  const { embedding: _embedding, ...rest } = stored;
  return NextResponse.json(rest);
}

/** POST rewrites the profile now, even if nothing changed. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const db = await getDb();
  if (!(await getProject(db, id))) return NextResponse.json({ error: `No project with id "${id}".` }, { status: 404 });
  const { profile } = await refreshProfile(db, id, {}, true);
  const { embedding: _embedding, ...rest } = profile;
  return NextResponse.json(rest);
}
