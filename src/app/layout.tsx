import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { listProjects } from '@/lib/db/repo';
import { claudeFromEnv } from '@/lib/llm';
import { embedderFromEnv } from '@/lib/similarity';
import { COLORS } from '@/lib/colors';
import './globals.css';

export const metadata: Metadata = { title: 'PM-AVN', description: 'Projects, meetings and what they have in common.' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const projects = await listProjects(await getDb());
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..700&family=Hanken+Grotesk:wght@400..700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="shell">
          <aside className="rail">
            <Link className="mark" href="/">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12z" fill="currentColor" /></svg>
              <span>PM-AVN</span>
            </Link>
            <nav aria-label="Workspace"><Link href="/">Portfolio</Link></nav>
            <h2>Projects</h2>
            <nav aria-label="Projects">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <i className="dot" style={{ background: COLORS[p.color % COLORS.length] }} />
                  <span>{p.name}</span>
                </Link>
              ))}
            </nav>
            <div className="foot">
              <div>Profiles: {claudeFromEnv() ? 'written by Claude' : 'offline extractor'}</div>
              <div>Embeddings: {embedderFromEnv().model}</div>
              <div>Database: {process.env.DATABASE_URL ? 'Postgres' : 'embedded'}</div>
            </div>
          </aside>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
