CREATE TABLE IF NOT EXISTS reports (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  device_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_alert_summary boolean NOT NULL DEFAULT true,
  include_command_summary boolean NOT NULL DEFAULT true,
  bucket_interval text NOT NULL DEFAULT 'day',
  period_days integer NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id serial PRIMARY KEY,
  report_id integer NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  frequency text NOT NULL,
  hour_of_day integer NOT NULL DEFAULT 8,
  day_of_week integer,
  day_of_month integer,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  format text NOT NULL DEFAULT 'pdf',
  active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_schedules_dispatch ON report_schedules (active, next_run_at);

CREATE TABLE IF NOT EXISTS report_runs (
  id bigserial PRIMARY KEY,
  report_id integer NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  schedule_id integer REFERENCES report_schedules(id) ON DELETE SET NULL,
  status text NOT NULL,
  error text,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_runs_report ON report_runs (report_id, generated_at DESC);
