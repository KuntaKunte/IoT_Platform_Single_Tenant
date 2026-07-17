// Thin REST client used by every examples/<industry>/seed.js script.
// Talks to the platform's real, public API only — no internal imports,
// no direct DB access. Proves the public API surface alone is enough
// to stand up an industry vertical.

import { writeFileSync, readFileSync } from 'node:fs';

async function apiRequest(baseUrl, token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status} ${data?.error || text}`);
  }
  return data;
}

export async function login(baseUrl, email, password) {
  const result = await apiRequest(baseUrl, null, 'POST', '/api/v1/auth/login', { email, password });
  return result.tokens.accessToken;
}

export async function createDeviceTemplate(baseUrl, token, { name, defaults }) {
  const { template } = await apiRequest(baseUrl, token, 'POST', '/api/v1/devices/templates', { name, defaults });
  return template;
}

export async function provisionDevice(baseUrl, token, { templateId, name }) {
  const { device } = await apiRequest(baseUrl, token, 'POST', '/api/v1/devices/provision', { templateId, name });
  return device;
}

export async function createRule(baseUrl, token, rule) {
  const { rule: created } = await apiRequest(baseUrl, token, 'POST', '/api/v1/rules', rule);
  return created;
}

export async function createDashboardTemplate(baseUrl, token, { name, description, layout }) {
  const { template } = await apiRequest(baseUrl, token, 'POST', '/api/v1/dashboards/templates', {
    name,
    description,
    layout
  });
  return template;
}

export async function instantiateDashboard(baseUrl, token, templateId, { name, description }) {
  const { dashboard } = await apiRequest(baseUrl, token, 'POST', `/api/v1/dashboards/templates/${templateId}/instantiate`, {
    name,
    description
  });
  return dashboard;
}

export async function createReport(baseUrl, token, report) {
  const { report: created } = await apiRequest(baseUrl, token, 'POST', '/api/v1/reports', report);
  return created;
}

export async function createReportSchedule(baseUrl, token, reportId, schedule) {
  const { schedule: created } = await apiRequest(baseUrl, token, 'POST', `/api/v1/reports/${reportId}/schedules`, schedule);
  return created;
}

export function parseArgs(argv) {
  const args = { apiUrl: process.env.API_URL || 'http://localhost:3000' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--api-url') args.apiUrl = argv[++i];
    else if (argv[i] === '--email') args.email = argv[++i];
    else if (argv[i] === '--password') args.password = argv[++i];
  }
  args.email = args.email || process.env.ADMIN_EMAIL;
  args.password = args.password || process.env.ADMIN_PASSWORD;

  if (!args.email || !args.password) {
    throw new Error(
      'Missing credentials. Pass --email/--password or set ADMIN_EMAIL/ADMIN_PASSWORD. ' +
        'The account must already hold the "manager" or "admin" role.'
    );
  }
  return args;
}

export function saveState(filePath, state) {
  writeFileSync(filePath, JSON.stringify(state, null, 2));
}

export function loadState(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
