CREATE TABLE IF NOT EXISTS plugins (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  version text NOT NULL,
  description text,
  manifest jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  error text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
