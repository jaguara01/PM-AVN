'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { createProject } from '@/lib/db/repo';
import { loadExamples } from '@/lib/examples';
import { refreshAllProfiles, refreshProfile } from '@/lib/services/profiles';

export async function addProject(form: FormData) {
  const name = String(form.get('name') ?? '').trim();
  if (!name) return;
  const db = await getDb();
  const project = await createProject(db, { name, description: String(form.get('description') ?? '').trim() });
  await refreshProfile(db, project.id);
  revalidatePath('/', 'layout');
  redirect(`/projects/${project.id}`);
}

export async function loadExampleProjects() {
  const db = await getDb();
  await loadExamples(db);
  await refreshAllProfiles(db);
  revalidatePath('/', 'layout');
}

export async function refreshAll() {
  await refreshAllProfiles(await getDb(), {}, true);
  revalidatePath('/', 'layout');
}

export async function refreshOne(form: FormData) {
  const id = String(form.get('id'));
  await refreshProfile(await getDb(), id, {}, true);
  revalidatePath(`/projects/${id}`);
}

/** Remembers who is using this browser, for My work. There is no sign-in yet. */
export async function choosePerson(form: FormData) {
  const person = String(form.get('person') ?? '').trim();
  const jar = await cookies();
  if (person) jar.set('pmavn_person', person, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' });
  else jar.delete('pmavn_person');
  redirect('/my-work');
}
