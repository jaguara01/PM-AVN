import { readFileSync, rmSync, writeFileSync } from 'node:fs';

/** True when a process with this id is running. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export class DatabaseInUseError extends Error {}

/**
 * The embedded database can only be opened by one process at a time: two processes writing the same files
 * lose each other's changes without any error. This lock turns that into a clear message instead.
 * A lock left by a process that no longer runs is taken over. Returns a function that releases the lock.
 */
export function acquireLock(file: string, pid = process.pid, alive: (pid: number) => boolean = isAlive): () => void {
  let holder: number | null = null;
  try {
    holder = Number(readFileSync(file, 'utf8').trim()) || null;
  } catch {
    holder = null;
  }
  if (holder && holder !== pid && alive(holder)) {
    throw new DatabaseInUseError(
      `The database in .data/ is already open in another PM-AVN process (process ${holder}). ` +
        'Only one can use it at a time: stop `npm run dev` before running `npm run db:seed` or `npm run profiles`, or stop the script before starting the app.',
    );
  }
  writeFileSync(file, String(pid));
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      if (readFileSync(file, 'utf8').trim() === String(pid)) rmSync(file);
    } catch {}
  };
  process.once('exit', release);
  return release;
}
