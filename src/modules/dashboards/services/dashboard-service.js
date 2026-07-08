import { dbClient } from '../../../shared/database.js';
import { getFieldValue } from '../../../shared/object-path.js';
import { getLatestValues, getHistoricalTelemetry, getDeviceStatus } from '../../mqtt/services/mqtt-service.js';
import { listAlerts } from '../../notifications/services/alert-service.js';
import { getDevice } from '../../devices/services/device-service.js';
import {
  createDashboardSchema,
  updateDashboardSchema,
  createTemplateSchema,
  instantiateTemplateSchema
} from '../validation.js';
import { DashboardRepository } from '../repositories/dashboard-repository.js';
import { DashboardTemplateRepository } from '../repositories/dashboard-template-repository.js';

const dashboardRepository = new DashboardRepository(dbClient);
const templateRepository = new DashboardTemplateRepository(dbClient);

const widgetResolvers = {
  async chart(widget) {
    const { items } = await getHistoricalTelemetry(widget.config.deviceId, {
      limit: widget.config.historyLimit || 50
    });
    return items
      .map((item) => ({ receivedAt: item.received_at, value: getFieldValue(item.payload, widget.config.metric) }))
      .reverse();
  },
  async gauge(widget) {
    const latest = await getLatestValues(widget.config.deviceId);
    return {
      value: latest ? getFieldValue(latest.payload, widget.config.metric) : null,
      min: widget.config.min,
      max: widget.config.max
    };
  },
  async status_card(widget) {
    return getDeviceStatus(widget.config.deviceId);
  },
  async alarm_list(widget) {
    const alerts = await listAlerts();
    const filtered = widget.config.severity ? alerts.filter((alert) => alert.severity === widget.config.severity) : alerts;
    return filtered.slice(0, widget.config.limit || 10);
  },
  async map(widget) {
    const deviceIds = widget.config.deviceIds || [];
    const points = [];
    for (const deviceId of deviceIds) {
      try {
        const device = await getDevice(deviceId);
        const location = device.metadata?.location;
        if (location && location.lat != null && location.lng != null) {
          points.push({ deviceId, name: device.name, lat: location.lat, lng: location.lng });
        }
      } catch (_err) {
        // Device missing/deleted since the widget was configured — just omit it.
      }
    }
    return points;
  }
};

export function registerWidgetResolver(type, fn) {
  if (widgetResolvers[type]) {
    throw new Error(`Dashboard widget type "${type}" is already registered`);
  }
  widgetResolvers[type] = fn;
}

export function unregisterWidgetResolver(type) {
  delete widgetResolvers[type];
}

async function resolveWidgetData(widget) {
  const resolver = widgetResolvers[widget.type];
  return resolver ? resolver(widget) : null;
}

export async function createDashboard(input) {
  const { error, value } = createDashboardSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  return dashboardRepository.create(value);
}

export async function getDashboard(id) {
  const dashboard = await dashboardRepository.findById(id);
  if (!dashboard) {
    throw Object.assign(new Error('Dashboard not found'), { status: 404 });
  }
  return dashboard;
}

export async function listDashboards() {
  return dashboardRepository.findAll();
}

export async function updateDashboard(id, input) {
  const { error, value } = updateDashboardSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  await getDashboard(id);
  return dashboardRepository.update(id, value);
}

export async function deleteDashboard(id) {
  await getDashboard(id);
  await dashboardRepository.delete(id);
}

export async function getDashboardData(id) {
  const dashboard = await getDashboard(id);
  const widgets = await Promise.all(
    dashboard.layout.map(async (widget) => {
      try {
        return { id: widget.id, type: widget.type, title: widget.title, data: await resolveWidgetData(widget) };
      } catch (err) {
        return { id: widget.id, type: widget.type, title: widget.title, data: null, error: err.message };
      }
    })
  );
  return { dashboardId: id, widgets };
}

export async function createTemplate(input) {
  const { error, value } = createTemplateSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  return templateRepository.create(value);
}

export async function getTemplate(id) {
  const template = await templateRepository.findById(id);
  if (!template) {
    throw Object.assign(new Error('Template not found'), { status: 404 });
  }
  return template;
}

export async function listTemplates() {
  return templateRepository.findAll();
}

export async function createDashboardFromTemplate(templateId, input) {
  const { error, value } = instantiateTemplateSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  const template = await getTemplate(templateId);
  return dashboardRepository.create({ name: value.name, description: value.description, layout: template.layout });
}
