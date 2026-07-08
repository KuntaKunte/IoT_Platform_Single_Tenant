CREATE TABLE IF NOT EXISTS dashboard_templates (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboards (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
