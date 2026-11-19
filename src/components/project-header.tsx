'use client';

import { deleteProjectAction, updateProjectAction } from '@/app/task-actions';
import { ConfirmButton, InlineText } from './inline-text';

export function ProjectHeader({ id, name, description, color }: { id: string; name: string; description: string; color: string }) {
  return (
    <section className="top">
      <div className="grow">
        <div className="ptitle">
          <i className="dot lg" style={{ background: color }} />
          <InlineText id="p-name" className="h1in" value={name} label="Project name" save={async (v) => { const r = await updateProjectAction(id, { name: v }); return r.ok ? undefined : r.error; }} />
        </div>
        <InlineText id="p-desc" className="subin" value={description} placeholder="Add a one-line description" label="Project description" save={async (v) => { const r = await updateProjectAction(id, { description: v }); return r.ok ? undefined : r.error; }} />
      </div>
      <ConfirmButton label="Delete project" confirmLabel="Click again: deletes the project and its tasks" action={() => deleteProjectAction(id)} />
    </section>
  );
}
