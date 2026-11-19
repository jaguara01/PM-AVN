import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DatabaseInUseError, acquireLock } from '@/lib/db/lock';

const lockFile = () => path.join(mkdtempSync(path.join(tmpdir(), 'pmavn-')), 'pglite.lock');

describe('one process per embedded database', () => {
  it('refuses when another running process holds the lock', () => {
    const f = lockFile();
    writeFileSync(f, '4242');
    expect(() => acquireLock(f, 1, (pid) => pid === 4242)).toThrow(DatabaseInUseError);
  });
  it('takes over a lock left by a process that stopped', () => {
    const f = lockFile();
    writeFileSync(f, '4242');
    const release = acquireLock(f, 1, () => false);
    release();
    expect(existsSync(f)).toBe(false);
  });
  it('lets the same process open it again and releases only its own lock', () => {
    const f = lockFile();
    const release = acquireLock(f, 7, () => true);
    expect(() => acquireLock(f, 7, () => true)).not.toThrow();
    writeFileSync(f, '8');
    release();
    expect(existsSync(f)).toBe(true);
  });
});
