import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { listProfiles, listProjects } from '@/lib/db/repo';
import { strongestPairs } from '@/lib/services/profiles';
import { addProject, loadExampleProjects, refreshAll } from '../actions';
import { Icon } from '../icons';
import { Score } from '../score';

export const dynamic = 'force-dynamic';

export default async function Portfolio() {
  const db = await getDb();
  const [projects, profiles, pairs] = await Promise.all([listProjects(db), listProfiles(db), strongestPairs(db, 6)]);
  const name = (id: string) => projects.find((p) => p.id === id)?.name ?? id;
  const profileOf = (id: string) => profiles.find((p) => p.projectId === id)?.profile;
  const best = pairs[0];

  return (
    <>
      <section className="top">
        <div>
          <h1>The project portfolio: what our projects have in common</h1>
          <p className="welcome">Find the team that already solved your problem.</p>
          <p className="sub">Each project has a profile with a summary, keywords and the technologies it uses. Profiles are compared so you can reuse what works instead of starting from scratch.</p>
        </div>
        {projects.length > 0 && (
          <form action={refreshAll}><button className="btn"><Icon name="refresh" />Rewrite all profiles</button></form>
        )}
      </section>

      {projects.length === 0 ? (
        <div className="empty" style={{ marginTop: 32 }}>
          <b>No projects yet</b>
          <p className="muted">Add your first project below, or load six example projects to see how matching works.</p>
          <form action={loadExampleProjects}><button className="btn solid">Load example projects</button></form>
        </div>
      ) : (
        <div className="cols">
          <section className="card c1">
            <h2><span className="num">1</span>Closest matches</h2>
            <div className="rows">
              {pairs.map((p) => (
                <div className="row pair" key={p.fromId + p.projectId}>
                  <Score value={p.score} />
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
          <section className="card c4">
            <h2><span className="num">2</span>All projects</h2>
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

      {best && (
        <aside className="tip">
          <Icon name="bulb" size={22} />
          <span><b>{name(best.fromId)}</b> and <b>{name(best.projectId)}</b> are the closest pair. {best.reason} <Link href={`/projects/${best.fromId}`}>Compare them</Link>.</span>
        </aside>
      )}

      <section className="card c2" id="add-project" style={{ marginTop: 32, maxWidth: 640 }}>
        <h2><span className="num">{projects.length ? 3 : 1}</span>Add a project</h2>
        <form className="new" action={addProject}>
          <label>Name<input name="name" required /></label>
          <label>What is it, for whom, and with which tools?<textarea name="description" rows={3} /></label>
          <div className="bar"><button className="btn solid">Add project</button></div>
        </form>
      </section>
    </>
  );
}
