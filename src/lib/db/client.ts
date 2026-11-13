import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const SCHEMA_PATH = path.join(process.cwd(), 'src/lib/db/schema.sql');

async function migrate(db: Db): Promise<void> {
  await db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
}

/** Embedded Postgres (PGlite) with pgvector. `dataDir` undefined keeps it in memory, which the tests use. */
export async function openEmbedded(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { vector } = await import('@electric-sql/pglite-pgvector');
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite({ dataDir, extensions: { vector } });
  const db: Db = {
    query: async (text, params) => ({ rows: (await pg.query(text, params)).rows as never[] }),
    exec: async (sql) => void (await pg.exec(sql)),
    close: () => pg.close(),
  };
  await migrate(db);
  return db;
}

async function openPostgres(url: string): Promise<Db> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url });
  const db: Db = {
    query: async (text, params) => ({ rows: (await pool.query(text, params as unknown[])).rows as never[] }),
    exec: async (sql) => void (await pool.query(sql)),
    close: () => pool.end(),
  };
  await migrate(db);
  return db;
}

// One connection per process, surviving Next.js hot reloads in development.
const g = globalThis as unknown as { __pmavnDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__pmavnDb) {
    const url = process.env.DATABASE_URL;
    g.__pmavnDb = url ? openPostgres(url) : openEmbedded(path.join(process.cwd(), '.data/pglite'));
  }
  return g.__pmavnDb;
}
