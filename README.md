# PM-AVN

Project management with meetings built in, and a portfolio view that shows which projects are alike.

This repository is the start of the real application. It contains:

- **The application** (`src/`): Next.js and TypeScript on Postgres with pgvector. Today it covers the portfolio: project profiles and project similarity.
- **The prototype** (`prototype/`): the single-page PM-AVN app with boards, lists, timelines, meeting notes from transcripts and documents. It is the reference for what still has to be ported. See `docs/roadmap.md`.

## Run it

Needs Node 22 or newer. No database, API key or Docker is required to start.

```bash
npm install
npm run dev          # http://localhost:3000
```

On the first page, choose **Load example projects**. With nothing configured the app uses an embedded Postgres stored in `.data/`, an offline profile extractor and a local embedder. That is enough to develop and test; it is not good matching.

For real profiles and real matching, copy `.env.example` to `.env.local` and set:

| Setting | What it turns on |
|---|---|
| `ANTHROPIC_API_KEY` | Claude writes each profile (summary, goals, keywords, technologies, domains) |
| `EMBEDDINGS_BASE_URL`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_API_KEY` | A real embedding model, through any OpenAI-style `/embeddings` endpoint |
| `DATABASE_URL` | A shared Postgres with pgvector (`docker compose up -d` starts one locally) |

After changing the Claude model or the embedding model, run `npm run profiles -- --force`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm test` | Run the tests (they use an in-memory Postgres with pgvector) |
| `npm run typecheck` | Type-check |
| `npm run build` | Production build |
| `npm run db:seed` | Load example projects and write their profiles |
| `npm run profiles` | Rewrite profiles for projects whose content changed |
| `npm run prototype` | Build `prototype/index.html` |

With the embedded database, stop `npm run dev` before running `db:seed` or `profiles`: only one process can open `.data/` at a time.

## How similarity works

1. Each project's description, tasks and meeting notes are turned into a **profile**: summary, goals, keywords, technologies, domains, deliverables.
2. The profile is **embedded** and stored in Postgres next to the project.
3. Two projects are scored with a **hybrid** of embedding similarity (meaning) and overlap of technologies, keywords and domains, where rare shared terms count for more than common ones.
4. Every match comes with the shared items and a one-line reason.

Details and the reasoning behind the choices are in `docs/similarity.md`.

## API

| Route | |
|---|---|
| `GET /api/projects` | Projects with their profiles |
| `POST /api/projects` `{name, description}` | Create a project and write its profile |
| `GET /api/projects/:id/profile` | One profile |
| `POST /api/projects/:id/profile` | Rewrite one profile now |
| `GET /api/projects/:id/similar?limit=5` | Ranked similar projects with score parts and shared items |

## Working together

Read `CLAUDE.md` first: it is the shared brief for people and for Claude Code. Pick work from `docs/roadmap.md`.
