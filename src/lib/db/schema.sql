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

-- Meetings: everything needed to show notes and review action items. Added after the first version, hence ALTER.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS title_edited boolean NOT NULL DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT '';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS wake text NOT NULL DEFAULT 'Claude';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS redact boolean NOT NULL DEFAULT true;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS domains text NOT NULL DEFAULT '';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external jsonb NOT NULL DEFAULT '[]';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS speakers jsonb NOT NULL DEFAULT '[]';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS board jsonb;                        -- whiteboard layout, null until first opened
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS chat jsonb NOT NULL DEFAULT '[]';   -- [{role, content}]

-- Action items found in a meeting, waiting for review. Sending one to a board creates a task and links it here.
CREATE TABLE IF NOT EXISTS meeting_actions (
  id         text PRIMARY KEY,
  meeting_id text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  task       text NOT NULL,
  owner      text NOT NULL DEFAULT 'Unassigned',
  due_said   text,                                 -- the deadline as spoken, e.g. "by Friday"
  due        date,                                 -- that deadline as a date, when it could be worked out
  priority   text NOT NULL DEFAULT 'medium',
  turn       integer NOT NULL DEFAULT 0,
  task_id    text REFERENCES tasks(id) ON DELETE SET NULL,
  position   integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS meeting_actions_meeting_idx ON meeting_actions(meeting_id);

-- Documents written from a meeting or a project.
CREATE TABLE IF NOT EXISTS documents (
  id         text PRIMARY KEY,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  meeting_id text REFERENCES meetings(id) ON DELETE CASCADE,
  name       text NOT NULL,
  template   text NOT NULL DEFAULT 'custom',
  body       text NOT NULL,
  written_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
