CREATE TABLE IF NOT EXISTS rules (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  device_id integer REFERENCES devices(id) ON DELETE CASCADE,
  condition_logic text NOT NULL DEFAULT 'all',
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rules_device_enabled ON rules (device_id, enabled);

CREATE TABLE IF NOT EXISTS rule_versions (
  id bigserial PRIMARY KEY,
  rule_id integer NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL,
  device_id integer,
  condition_logic text NOT NULL,
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rule_versions_rule ON rule_versions (rule_id, version DESC);

CREATE TABLE IF NOT EXISTS rule_history (
  id bigserial PRIMARY KEY,
  rule_id integer NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  device_id integer NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  triggering_payload jsonb NOT NULL,
  actions_result jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rule_history_rule_evaluated ON rule_history (rule_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_history_device_evaluated ON rule_history (device_id, evaluated_at DESC);
