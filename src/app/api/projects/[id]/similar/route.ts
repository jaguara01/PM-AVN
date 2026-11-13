import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { getProject } from '@/lib/db/repo';
import { similarProjects } from '@/lib/services/profiles';

export const dynamic = 'force-dynamic';

/** GET /api/projects/:id/similar?limit=5 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  if (!(await getProject(db, id))) return NextResponse.json({ error: `No project with id "${id}".` }, { status: 404 });
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 5));
  return NextResponse.json(await similarProjects(db, id, limit));
}
