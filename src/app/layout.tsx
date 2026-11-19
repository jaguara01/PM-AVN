import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { listProjects } from '@/lib/db/repo';
import { llmFromEnv } from '@/lib/llm';
import { embedderFromEnv } from '@/lib/similarity';
import { COLORS } from '@/lib/colors';
import { Icon } from './icons';
import { ThemeToggle } from './theme-toggle';
import { NavLink } from './nav-link';
import './globals.css';

export const metadata: Metadata = { title: 'PM-AVN', description: 'Projects, meetings and what they have in common.' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const projects = await listProjects(await getDb());
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Nunito+Sans:opsz,wght@6..12,300..800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="topbar">
          <Link className="brand" href="/" aria-label="PM-AVN portfolio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/element61-logo.png" alt="element61" width={104} height={42} />
            <b>PM-AVN</b>
            <span>Project management</span>
          </Link>
          <nav className="tnav" aria-label="Main">
            <NavLink href="/"><Icon name="portfolio" />Portfolio</NavLink>
            <details className="pmenu">
              <summary className="nav"><Icon name="folder" />Projects<Icon name="down" size={16} /></summary>
              <div className="pmenu-list">
                {projects.map((p) => (
                  <NavLink key={p.id} href={`/projects/${p.id}`}>
                    <i className="dot" style={{ background: COLORS[p.color % COLORS.length] }} />
                    <span>{p.name}</span>
                  </NavLink>
                ))}
                {projects.length === 0 && <span className="nav muted">No projects yet</span>}
              </div>
            </details>
          </nav>
          <div className="tright">
            <ThemeToggle />
            <Link className="btn solid pill" href="/#add-project"><Icon name="plus" size={17} />New project</Link>
          </div>
        </header>
        <main>
          {children}
          <footer className="foot">
            <span>Profiles: {llmFromEnv()?.name ?? 'offline extractor'}</span>
            <span>Embeddings: {embedderFromEnv().model}</span>
            <span>Database: {process.env.DATABASE_URL ? 'Postgres' : 'embedded'}</span>
          </footer>
        </main>
      </body>
    </html>
  );
}
