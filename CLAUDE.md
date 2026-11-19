# PM-AVN

Project management app with meeting notes from transcripts and a portfolio view that finds similar projects.
Several people work in this repository, each with Claude Code. This file is the shared brief: keep it short and current.

## Where things are

- `src/lib/similarity/` — pure logic, no database or network: profile types, term normalisation, extraction (Claude and offline), embedders, hybrid scoring.
- `src/lib/db/` — `schema.sql` (idempotent, run on start), `client.ts` (Postgres or embedded PGlite), `repo.ts` (all SQL lives here).
- `src/lib/services/profiles.ts` — ties the above together: refresh a profile, rank similar projects.
- `src/lib/transcript/` — transcript parser and offline meeting heuristics (`core.js`, from the prototype) behind a typed `index.ts`.
- `src/lib/meetings/` — meeting analysis with a model, prompts for documents, questions and in-call requests.
- `src/lib/services/` — `profiles.ts` (similarity), `meetings.ts` (import, review queue, documents), `sources.ts`.
- `src/app/` — Next.js App Router pages, server actions in `actions.ts`, JSON routes under `api/`.
- `prototype/` — the single-page app this product started as. Reference for porting; do not add features there.
- `docs/` — `architecture.md`, `similarity.md`, `roadmap.md`, `design.md` (colours, type and patterns: follow it for any screen).

## Commands

```bash
npm run dev         # app on :3000, embedded database in .data/
npm test            # vitest, in-memory Postgres with pgvector
npm run typecheck
npm run build
```

## Rules for changes

- A change is done when `npm test`, `npm run typecheck` and `npm run build` all pass. Run them before saying it works.
- Logic goes in `src/lib` with tests in `tests/`. Pages stay thin.
- All SQL goes through `src/lib/db/repo.ts`. Schema changes go in `schema.sql` and must stay safe to run repeatedly (`IF NOT EXISTS`, additive `ALTER`).
- Everything must keep working with no environment variables set: the offline extractor and local embedder are the default in tests and in fresh checkouts. Never make a test depend on a network call or an API key.
- Claude and embedding calls are passed in as functions or objects (`CompleteFn`, `Embedder`). Tests pass stubs.
- Vectors from different embedding models are never compared. Keep the `embedding_model` filter in any new query.
- Never commit `.env.local`, `.data/` or real customer transcripts. Use `prototype/sample.txt` or invented data in tests.
- Interface text: sentence case, plain verbs, name things the way a project manager would. No emoji.

## Working with others

- One branch per task, named `area/short-description` (for example `board/drag-and-drop`). Open a pull request into `main`; do not push to `main` directly.
- Take a task from `docs/roadmap.md` and put your name next to it in the same pull request, so two people do not start the same thing.
- Keep pull requests small enough to review in one sitting. Say what you ran and what you did not test.
- If you change a rule in this file or a decision in `docs/`, do it in its own pull request.

## Things that are easy to get wrong

- With the embedded database only one process can open `.data/`. Stop `npm run dev` before running `npm run db:seed` or `npm run profiles`.
- Route handlers and pages receive `params` as a Promise in this Next.js version: `const { id } = await params`.
- `scripts/*.mts` use top-level await; keep the `.mts` extension.
- The offline extractor only recognises technologies in its own list (`KNOWN_TECH` in `extract.ts`). Low scores in a fresh checkout are expected.
