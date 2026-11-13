# Project similarity

Goal: for any project, show which other projects resemble it and why, so teams can reuse work, find people who solved the same problem and spot duplicated effort.

## Pipeline

1. **Source text** (`source.ts`). Project name and description, task titles and notes, meeting summaries and decisions, capped at 24,000 characters. A hash of this text decides whether a profile needs rewriting.
2. **Profile** (`extract.ts`). Claude returns JSON: `summary`, `goals`, `keywords`, `technologies`, `domains`, `deliverables`. The reply is validated, and terms are normalised (`normalize.ts`) so "Postgres", "postgresql" and "PG" are one technology. With no API key, an offline extractor fills the same shape from word counts and a fixed technology list.
3. **Embedding** (`embed.ts`). The profile, not the raw source, is turned into text and embedded. Any service with an OpenAI-style `/embeddings` endpoint works. With none configured, a local word-hashing embedder is used; it matches wording, not meaning.
4. **Score** (`score.ts`). For two projects:

   | Part | Default weight | How |
   |---|---|---|
   | Meaning | 0.55 | Cosine similarity of the two embeddings |
   | Technologies | 0.25 | Overlap, each term weighted by rarity across the portfolio |
   | Keywords | 0.15 | Same |
   | Domains | 0.05 | Same |

   A part with no data on either side is left out and its weight is shared among the rest, so an empty technology list does not count as "nothing in common".
5. **Explanation.** Each result carries the shared technologies, keywords and domains and a one-line reason built from them.

## Why hybrid rather than embeddings alone

Embeddings capture that two descriptions mean similar things, but they give a number with no reason, and they blur exact facts: two projects on the same rare platform should match even if their descriptions differ. Explicit overlap gives the reason and the exact match; embeddings catch what the term lists miss. Weighting by rarity stops a tool everybody uses from making everything look alike.

## Known limits

- The weights are a starting guess. Nobody has checked them against real projects yet.
- Quality depends on what is written down. A project with a one-line description and no tasks gets a thin profile.
- Scores in offline mode are low and rough. Judge matching only with Claude and a real embedding model configured.
- All profiles are loaded to rank one project. Fine for hundreds; for more, shortlist with `nearestByEmbedding` (pgvector, already in `repo.ts`) and rerank the shortlist.

## Ideas worth trying next

- **Evaluation set.** Ask project leads for 20 to 30 pairs they consider similar or not, then tune weights against it. Do this before anything else below.
- **Claude as reranker.** For the top 10 candidates, have Claude judge the pair and write the reason, including what one team could reuse from the other.
- **Chunk-level search.** Embed meeting decisions and task groups separately to answer "who else has dealt with X?", not only "which projects are alike".
- **Controlled vocabulary.** Let admins merge or rename technologies and domains instead of relying on the alias list.
- **Clusters and a map.** Group the portfolio into themes and show them on one screen.
- **Refresh on change.** Rewrite a profile when tasks or meetings change, in a background job.
