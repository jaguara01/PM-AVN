-- Idempotent: safe to run on every start.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS projects (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  color       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id         text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  status     text NOT NULL DEFAULT 'todo',      -- todo | doing | review | done
  owner      text NOT NULL DEFAULT 'Unassigned',
  due        date,
  start      date,
  priority   text NOT NULL DEFAULT 'medium',    -- high | medium | low
  notes      text NOT NULL DEFAULT '',
  meeting_id text,
  turn       integer,
  position   double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);

CREATE TABLE IF NOT EXISTS meetings (
  id         text PRIMARY KEY,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  title      text NOT NULL,
  held_on    date,
  summary    text NOT NULL DEFAULT '',
  analysis   jsonb NOT NULL DEFAULT '{}',        -- topics, decisions, questions, risks, commands
  turns      jsonb NOT NULL DEFAULT '[]',        -- [{i, spk, t, text}]
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meetings_project_idx ON meetings(project_id);

-- One comparable profile per project. The vector column has no fixed size so the embedding
-- model can be changed without a migration; rows are only compared within one embedding_model.
-- Exact search is fine for thousands of projects. Past that, fix the size and add an HNSW index.
CREATE TABLE IF NOT EXISTS project_profiles (
  project_id      text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  profile         jsonb NOT NULL,
  embedding       vector NOT NULL,
  embedding_model text NOT NULL,
  extractor       text NOT NULL,                 -- model id, or 'offline'
  content_hash    text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
