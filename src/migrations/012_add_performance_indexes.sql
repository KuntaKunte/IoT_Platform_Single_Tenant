-- Audit of every CREATE INDEX vs. every REFERENCES across src/migrations/*.sql found the
-- schema already well-indexed for its actual query patterns (every hot WHERE/JOIN path
-- already has a covering index from when its table was created). The one real gap:
-- GET /api/v1/reports/:reportId/schedules (ReportScheduleRepository.findByReport) filters
-- report_schedules by report_id with no supporting index.
CREATE INDEX IF NOT EXISTS idx_report_schedules_report ON report_schedules (report_id);
