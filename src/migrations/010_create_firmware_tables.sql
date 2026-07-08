CREATE TABLE IF NOT EXISTS firmware_versions (
  id serial PRIMARY KEY,
  device_type text NOT NULL,
  version text NOT NULL,
  description text,
  storage_key text NOT NULL,
  size_bytes bigint NOT NULL,
  checksum text NOT NULL,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_type, version)
);

CREATE TABLE IF NOT EXISTS firmware_deployments (
  id serial PRIMARY KEY,
  device_id integer NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  firmware_id integer NOT NULL REFERENCES firmware_versions(id) ON DELETE RESTRICT,
  command_id bigint NOT NULL REFERENCES device_commands(id) ON DELETE CASCADE,
  is_rollback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_firmware_deployments_device ON firmware_deployments (device_id, created_at DESC);

CREATE TABLE IF NOT EXISTS device_configurations (
  device_id integer PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  desired_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  desired_version integer NOT NULL DEFAULT 0,
  reported_config jsonb,
  reported_version integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS log_collections (
  id serial PRIMARY KEY,
  device_id integer NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  command_id bigint REFERENCES device_commands(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested',
  storage_key text,
  size_bytes bigint,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_log_collections_device ON log_collections (device_id, created_at DESC);
