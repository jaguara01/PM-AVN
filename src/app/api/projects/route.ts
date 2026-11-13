import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { createProject, listProfiles, listProjects } from '@/lib/db/repo';
import { refreshProfile } from '@/lib/services/profiles';

export const dynamic = 'force-dynamic';

/** All projects with their profiles (without the embedding vectors). */
export async function GET() {
  const db = await getDb();
  const [projects, profiles] = await Promise.all([listProjects(db), listProfiles(db)]);
  return NextResponse.json(projects.map((p) => ({ ...p, profile: profiles.find((x) => x.projectId === p.id)?.profile ?? null })));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: string; description?: string } | null;
  if (!body?.name?.trim()) return NextResponse.json({ error: 'Send a JSON body with a "name".' }, { status: 400 });
  const db = await getDb();
  const project = await createProject(db, { name: body.name.trim(), description: body.description?.trim() });
  const { profile } = await refreshProfile(db, project.id);
  return NextResponse.json({ ...project, profile: profile.profile }, { status: 201 });
}
