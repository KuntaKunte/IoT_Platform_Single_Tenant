CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  roles text[] NOT NULL DEFAULT ARRAY['viewer'],
  password_reset_requested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  roles text[] NOT NULL DEFAULT ARRAY['viewer'],
  created_at timestamptz NOT NULL DEFAULT now()
);
