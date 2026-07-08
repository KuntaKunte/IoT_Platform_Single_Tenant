CREATE TABLE IF NOT EXISTS sites (
  id serial PRIMARY KEY,
  name text NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id serial PRIMARY KEY,
  site_id integer REFERENCES sites(id) ON DELETE SET NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_types (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id serial PRIMARY KEY,
  asset_id integer REFERENCES assets(id) ON DELETE SET NULL,
  name text NOT NULL,
  device_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devices_name ON devices (name);

CREATE TABLE IF NOT EXISTS sensors (
  id serial PRIMARY KEY,
  device_id integer REFERENCES devices(id) ON DELETE CASCADE,
  name text NOT NULL,
  metric text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO device_templates (id, name, defaults)
VALUES ('temp-gateway', 'Gateway Template', '{"deviceType":"gateway","metadata":{"category":"gateway"}}')
ON CONFLICT (id) DO NOTHING;
