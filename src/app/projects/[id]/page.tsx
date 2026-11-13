import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getProfile, getProject, listProjects, listTasks } from '@/lib/db/repo';
import { similarProjects } from '@/lib/services/profiles';
import { refreshOne } from '../../actions';

export const dynamic = 'force-dynamic';

const PARTS = [['semantic', 'Meaning'], ['technologies', 'Technologies'], ['keywords', 'Keywords'], ['domains', 'Domain']] as const;

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
      <div className="top">
        <div>
          <h1>{project.name}</h1>
          <p className="sub">{project.description}</p>
        </div>
        <form action={refreshOne}><input type="hidden" name="id" value={id} /><button className="btn">Rewrite profile</button></form>
      </div>

      <div className="cols">
        <section>
          <h2>Profile</h2>
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
                <p className="note" style={{ marginTop: 24 }}>This profile was written by the offline extractor, which only counts words and recognises a fixed list of technologies. Set ANTHROPIC_API_KEY to have Claude write it.</p>
              )}
            </>
          ) : (
            <p className="muted">No profile yet. Use “Rewrite profile”.</p>
          )}
          <h2>Tasks <span className="muted">{tasks.length}</span></h2>
          <div className="rows">{tasks.map((t) => <div className="row" key={t.id}>{t.title}</div>)}</div>
        </section>

        <section>
          <h2>Similar projects</h2>
          {similar.length === 0 && <p className="muted">Nothing to compare with yet.</p>}
          <div className="rows">
            {similar.map((s) => (
              <div className="row pair" key={s.projectId}>
                <div className="score">{Math.round(s.score * 100)}<small>of 100</small></div>
                <div>
                  <b><Link href={`/projects/${s.projectId}`}>{name(s.projectId)}</Link></b>
                  <p>{s.reason}</p>
                  <div className="chips">{[...s.shared.technologies, ...s.shared.domains, ...s.shared.keywords].slice(0, 8).map((t) => <span className="chip shared" key={t}>{t}</span>)}</div>
                  <div className="parts">
                    {PARTS.map(([k, label]) => {
                      const v = s.parts[k];
                      return v === null ? null : (
                        <div key={k} style={{ display: 'contents' }}>
                          <span>{label}</span>
                          <div className="meter"><i style={{ width: `${Math.round(v * 100)}%` }} /></div>
                          <span>{Math.round(v * 100)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
