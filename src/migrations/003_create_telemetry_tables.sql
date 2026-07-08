CREATE TABLE IF NOT EXISTS device_status (
  device_id integer PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  last_topic text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_topics (
  device_id integer PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  topic text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry_history (
  id bigserial PRIMARY KEY,
  device_id integer NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_history_device_received
  ON telemetry_history (device_id, received_at DESC);
