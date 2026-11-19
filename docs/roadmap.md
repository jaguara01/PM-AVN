# Roadmap

Put your name after a task when you start it. Each item should fit in one pull request unless marked large.

## 1. Foundations

- [ ] Sign-in and users (large). Decide the provider first and record it in `architecture.md`.
- [ ] Workspaces and membership, so projects belong to a team.
- [ ] Run against real Postgres (`docker compose up -d`, set `DATABASE_URL`), fix whatever differs from PGlite, add it to CI.
- [ ] CI on pull requests: `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Versioned migrations in place of the single `schema.sql`.

## 2. Port the prototype

The behaviour to match is in `prototype/` (`npm run prototype`, then open `prototype/index.html`).

- [ ] Task API and server actions: create, edit, move, delete.
- [ ] Board with drag and drop between the four statuses.
- [ ] List with sorting and inline editing.
- [ ] Timeline.
- [ ] Task panel with source meeting and quoted transcript line.
- [ ] Home (next seven days, late, per-project progress) and My work.
- [ ] Meetings: import a transcript, store turns, quick offline notes (`src/lib/transcript/core.js` already does the parsing).
- [ ] Meetings: notes written by Claude, on the server.
- [ ] Meetings: review queue that sends action items to a board, with spoken deadlines turned into dates.
- [ ] Meetings: whiteboard, ask, requests addressed to Claude, documents.
- [ ] Project documents: status update, next-week plan, risk review.
- [ ] Type `src/lib/transcript/core.js` as TypeScript, keeping `tests/transcript.test.ts` green.
- [x] Choose a visual direction and apply it: element61 house style, see `design.md`.

## 3. Similarity

- [ ] Try it with Claude and a real embedding model on real projects; note what looks wrong.
- [ ] Evaluation set and weight tuning (see `similarity.md`).
- [ ] Edit a profile by hand, and keep manual edits when it is rewritten.
- [ ] Rewrite profiles automatically when tasks or meetings change.
- [ ] Claude reranks the top candidates and writes what could be reused.
- [ ] Search the portfolio by technology or keyword.
- [ ] Portfolio map with clusters.
