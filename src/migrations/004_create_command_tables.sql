CREATE TABLE IF NOT EXISTS device_commands (
  id bigserial PRIMARY KEY,
  device_id integer NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  next_attempt_at timestamptz,
  acknowledged_at timestamptz,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_commands_device_created ON device_commands (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_commands_dispatch ON device_commands (status, scheduled_at, next_attempt_at);
