import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { listMeetings, listProjects } from '@/lib/db/repo';
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
  const db = await getDb();
  const [projects, meetings] = await Promise.all([listProjects(db), listMeetings(db)]);
  const toReview = meetings.reduce((n, m) => n + m.toReview, 0);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Nunito+Sans:opsz,wght@6..12,300..800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="topbar">
          <Link className="brand" href="/" aria-label="PM-AVN home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/element61-logo.png" alt="element61" width={104} height={42} />
            <b>PM-AVN</b>
            <span>Project management</span>
          </Link>
          <nav className="tnav" aria-label="Main">
            <NavLink href="/"><Icon name="home" />Home</NavLink>
            <NavLink href="/my-work"><Icon name="me" />My work</NavLink>
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
                <hr />
                <Link className="nav" href="/portfolio#add-project"><Icon name="plus" size={16} />New project</Link>
              </div>
            </details>
            <NavLink href="/meetings"><Icon name="meetings" />Meetings{toReview > 0 && <em title="Action items waiting for review">{toReview}</em>}</NavLink>
            <NavLink href="/portfolio"><Icon name="portfolio" />Portfolio</NavLink>
          </nav>
          <div className="tright">
            <ThemeToggle />
            <Link className="btn solid pill" href="/meetings"><Icon name="plus" size={17} />New meeting</Link>
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
