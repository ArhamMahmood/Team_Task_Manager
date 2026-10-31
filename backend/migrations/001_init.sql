-- Team Task Manager: initial schema (idempotent, safe to run on every boot).

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         CITEXT      NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT,
  created_by  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id   INTEGER     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  status      TEXT        NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  assigned_to INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_by  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session storage (connect-pg-simple uses this exact shape).
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR      NOT NULL COLLATE "default" PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks (team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_team_status ON tasks (team_id, status);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);
