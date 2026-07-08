CREATE TABLE IF NOT EXISTS notification_templates (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  channel text,
  subject_template text,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id serial PRIMARY KEY,
  source text NOT NULL,
  rule_id integer REFERENCES rules(id) ON DELETE SET NULL,
  device_id integer REFERENCES devices(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  template_id integer REFERENCES notification_templates(id) ON DELETE SET NULL,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalation_policy jsonb NOT NULL DEFAULT '[]'::jsonb,
  escalation_level integer NOT NULL DEFAULT 0,
  next_escalation_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_escalation ON alerts (status, next_escalation_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id bigserial PRIMARY KEY,
  alert_id integer NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  channel text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_dispatch ON notification_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_alert ON notification_deliveries (alert_id, created_at DESC);
