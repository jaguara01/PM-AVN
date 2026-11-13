import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { listProfiles, listProjects } from '@/lib/db/repo';
import { strongestPairs } from '@/lib/services/profiles';
import { addProject, loadExampleProjects, refreshAll } from './actions';

export const dynamic = 'force-dynamic';

export default async function Portfolio() {
  const db = await getDb();
  const [projects, profiles, pairs] = await Promise.all([listProjects(db), listProfiles(db), strongestPairs(db, 6)]);
  const name = (id: string) => projects.find((p) => p.id === id)?.name ?? id;
  const profileOf = (id: string) => profiles.find((p) => p.projectId === id)?.profile;

  return (
    <>
      <div className="top">
        <div>
          <h1>Portfolio</h1>
          <p className="sub">Each project has a profile: a summary, its keywords and the technologies it uses. Profiles are compared to show which projects are alike.</p>
        </div>
        {projects.length > 0 && (
          <form action={refreshAll}><button className="btn">Rewrite all profiles</button></form>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="empty">
          <b>No projects yet</b>
          <p className="muted">Add your first project below, or load six example projects to see how matching works.</p>
          <form action={loadExampleProjects}><button className="btn solid">Load example projects</button></form>
        </div>
      ) : (
        <div className="cols">
          <section>
            <h2>Closest matches</h2>
            <div className="rows">
              {pairs.map((p) => (
                <div className="row pair" key={p.fromId + p.projectId}>
                  <div className="score">{Math.round(p.score * 100)}<small>of 100</small></div>
                  <div>
                    <b><Link href={`/projects/${p.fromId}`}>{name(p.fromId)}</Link> and <Link href={`/projects/${p.projectId}`}>{name(p.projectId)}</Link></b>
                    <p>{p.reason}</p>
                    <div className="chips">
                      {[...p.shared.technologies, ...p.shared.domains].slice(0, 6).map((t) => <span className="chip shared" key={t}>{t}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2>Projects</h2>
            <div className="rows">
              {projects.map((p) => {
                const prof = profileOf(p.id);
                return (
                  <Link className="row" href={`/projects/${p.id}`} key={p.id}>
                    <b>{p.name}</b>
                    <p>{prof?.summary || p.description || 'No description yet.'}</p>
                    <div className="chips">{prof?.technologies.slice(0, 6).map((t) => <span className="chip tech" key={t}>{t}</span>)}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <h2>Add a project</h2>
      <form className="new" action={addProject} style={{ maxWidth: 560 }}>
        <label>Name<input name="name" required /></label>
        <label>What is it, for whom, and with which tools?<textarea name="description" rows={3} /></label>
        <div className="bar"><button className="btn solid">Add project</button></div>
      </form>
    </>
  );
}
