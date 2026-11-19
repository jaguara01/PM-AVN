import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getProfile, getProject, listProjects, listTasks } from '@/lib/db/repo';
import { similarProjects } from '@/lib/services/profiles';
import { refreshOne } from '../../actions';
import { Icon } from '../../icons';
import { Score, ScoreParts } from '../../score';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const project = await getProject(db, id);
  if (!project) notFound();
  const [stored, similar, tasks, projects] = await Promise.all([getProfile(db, id), similarProjects(db, id, 5), listTasks(db, id), listProjects(db)]);
  const name = (pid: string) => projects.find((p) => p.id === pid)?.name ?? pid;
  const profile = stored?.profile;

  return (
    <>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 14 }}><Link href="/" style={{ color: 'inherit' }}>Portfolio</Link> / {project.name}</p>
      <section className="top">
        <div>
          <h1>{project.name}</h1>
          <p className="sub">{project.description}</p>
        </div>
        <form action={refreshOne}><input type="hidden" name="id" value={id} /><button className="btn"><Icon name="refresh" />Rewrite profile</button></form>
      </section>

      <div className="cols">
        <div style={{ display: 'grid', gap: 24 }}>
          <section className="card c1">
            <h2><span className="num">1</span>Profile</h2>
            {profile ? (
              <>
                <p className="lead">{profile.summary}</p>
                {profile.goals.length > 0 && (<><h2>Goals</h2><ul className="plain">{profile.goals.map((g) => <li key={g}>{g}</li>)}</ul></>)}
                <h2>Technologies</h2>
                <div className="chips">{profile.technologies.length ? profile.technologies.map((t) => <span className="chip tech" key={t}>{t}</span>) : <span className="muted">None named yet.</span>}</div>
                <h2>Keywords</h2>
                <div className="chips">{profile.keywords.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
                <h2>Domain</h2>
                <div className="chips">{profile.domains.length ? profile.domains.map((t) => <span className="chip" key={t}>{t}</span>) : <span className="muted">Not classified.</span>}</div>
                {stored.extractor === 'offline' && (
                  <p className="tip"><Icon name="bulb" size={20} /><span>This profile was written by the offline extractor, which only counts words and recognises a fixed list of technologies. Configure a text model (see “Choosing the AI services” in the README) to have it written properly.</span></p>
                )}
              </>
            ) : (
              <p className="muted">No profile yet. Use “Rewrite profile”.</p>
            )}
          </section>
          <section className="card c3">
            <h2><span className="num">3</span>Tasks <span className="muted" style={{ fontWeight: 600 }}>{tasks.length}</span></h2>
            <div className="rows">{tasks.map((t) => <div className="row" key={t.id}>{t.title}</div>)}</div>
          </section>
        </div>

        <section className="card c2">
          <h2><span className="num">2</span>Similar projects</h2>
          {similar.length === 0 && <p className="muted">Nothing to compare with yet.</p>}
          <div className="rows">
            {similar.map((s) => (
              <div className="row pair" key={s.projectId}>
                <Score value={s.score} />
                <div>
                  <b><Link href={`/projects/${s.projectId}`}>{name(s.projectId)}</Link></b>
                  <p>{s.reason}</p>
                  <div className="chips">{[...s.shared.technologies, ...s.shared.domains, ...s.shared.keywords].slice(0, 8).map((t) => <span className="chip shared" key={t}>{t}</span>)}</div>
                  <ScoreParts parts={s.parts} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
