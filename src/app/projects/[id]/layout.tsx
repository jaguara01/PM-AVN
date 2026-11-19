import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getProject } from '@/lib/db/repo';
import { COLORS } from '@/lib/colors';
import { ProjectHeader } from '@/components/project-header';
import { NavLink } from '../../nav-link';
import { PROJECT_TABS } from './tabs';

export const dynamic = 'force-dynamic';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(await getDb(), id);
  if (!project) notFound();
  const base = `/projects/${id}`;
  return (
    <>
      <p className="crumbs"><Link href="/">Home</Link> / {project.name}</p>
      <ProjectHeader key={`${project.name}|${project.description}`} id={id} name={project.name} description={project.description} color={COLORS[project.color % COLORS.length]} />
      <nav className="tabs" aria-label="Project views">
        {PROJECT_TABS.map((t) => (
          <NavLink key={t.slug} className="tab" href={t.slug ? `${base}/${t.slug}` : base} exact={!t.slug}>{t.label}</NavLink>
        ))}
      </nav>
      {children}
    </>
  );
}
