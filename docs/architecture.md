# Architecture

## Shape

One Next.js application (App Router, TypeScript) with Postgres. Pages render on the server and call `src/lib` directly; JSON routes under `src/app/api` expose the same functions for other clients.

```
browser ── pages / server actions / api routes ── services ── repo (SQL) ── Postgres + pgvector
                                                    │
                                                    ├── similarity (pure logic)
                                                    ├── Claude (profile extraction)
                                                    └── embedding service
```

## Decisions so far

| Decision | Why | Revisit when |
|---|---|---|
| Next.js, one repo, TypeScript front and back | One language and one deploy for a small team | A separate client (mobile, integrations) needs a standalone API |
| Postgres with pgvector | Projects, tasks and vectors in one database; no separate vector store to run | Tens of thousands of projects, or search across transcript chunks at scale |
| Embedded PGlite when `DATABASE_URL` is empty | Anyone can clone and run with no setup; tests use real SQL and real pgvector | Never for shared or production data |
| Plain SQL in `repo.ts`, no ORM | Small schema, and the same SQL runs on PGlite and Postgres | The schema grows past a dozen tables or needs versioned migrations |
| Vector column without a fixed size | The embedding model can change without a migration | An approximate index (HNSW) is needed, which requires a fixed size |
| Profiles compared, not raw text | Task lists are noisy; a profile says what a project is about | — |
| Claude and embeddings behind small interfaces | Tests run offline; providers can be swapped | — |

## Data

`projects`, `tasks`, `meetings` and `project_profiles`; see `src/lib/db/schema.sql`. Task and meeting columns already match the prototype's data so its features can be ported without reshaping.

## Not built yet

- Sign-in, users and permissions. Everything is one open workspace today. This must come before real data goes in.
- The board, list, timeline, meeting and document screens from the prototype.
- Background jobs. Profiles are refreshed on request or with `npm run profiles`.
- Not yet run by anyone: the `pg` connection path against a real Postgres, Claude extraction with a live key, and the HTTP embedder against a live service. The SQL itself is exercised by the tests through PGlite.
