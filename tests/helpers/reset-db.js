import { dbClient } from '../../src/shared/database.js';

export async function resetDatabase() {
  await dbClient.query(
    `TRUNCATE plugins,
              log_collections, device_configurations, firmware_deployments, firmware_versions,
              report_runs, report_schedules, reports, dashboards, dashboard_templates, notification_deliveries, alerts, notification_templates,
              rule_history, rule_versions, rules, telemetry_history, device_commands, device_status,
              device_topics, sensors, devices, device_types, assets, sites, api_keys, users
     RESTART IDENTITY CASCADE`
  );
}
