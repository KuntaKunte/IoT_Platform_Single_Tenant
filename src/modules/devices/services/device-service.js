import { dbClient } from '../../../shared/database.js';
import { SiteRepository } from '../repositories/site-repository.js';
import { AssetRepository } from '../repositories/asset-repository.js';
import { DeviceRepository } from '../repositories/device-repository.js';
import { SensorRepository } from '../repositories/sensor-repository.js';
import { DeviceTypeRepository } from '../repositories/device-type-repository.js';
import { DeviceTemplateRepository } from '../repositories/device-template-repository.js';

const siteRepository = new SiteRepository(dbClient);
const assetRepository = new AssetRepository(dbClient);
const deviceRepository = new DeviceRepository(dbClient);
const sensorRepository = new SensorRepository(dbClient);
const deviceTypeRepository = new DeviceTypeRepository(dbClient);
const deviceTemplateRepository = new DeviceTemplateRepository(dbClient);

export async function createSite(name, location) {
  return siteRepository.create({ name, location });
}

export async function createAsset(siteId, name) {
  return assetRepository.create({ site_id: siteId, name });
}

export async function createDevice(assetId, name, deviceType, metadata = {}) {
  return deviceRepository.create({ asset_id: assetId, name, device_type: deviceType, metadata });
}

export async function createSensor(deviceId, name, metric) {
  return sensorRepository.create({ device_id: deviceId, name, metric });
}

export async function createDeviceType(name, description) {
  return deviceTypeRepository.create({ name, description });
}

export async function createDeviceTemplate(name, defaults = {}) {
  const id = `temp-${name.toLowerCase().replace(/\s+/g, '-')}`;
  return deviceTemplateRepository.create({ id, name, defaults });
}

export async function searchDevices(query) {
  return deviceRepository.search(query);
}

export async function provisionDevice(templateId, name) {
  const template = await deviceTemplateRepository.findById(templateId);
  if (!template) {
    throw Object.assign(new Error('Template not found'), { status: 404 });
  }

  const defaults = template.defaults || {};
  return createDevice(null, name, defaults.deviceType || 'unknown', defaults.metadata || {});
}

export async function getDeviceRegistry() {
  const [sites, assets, devices, sensors, deviceTypes, deviceTemplates] = await Promise.all([
    siteRepository.findAll(),
    assetRepository.findAll(),
    deviceRepository.findAll(),
    sensorRepository.findAll(),
    deviceTypeRepository.findAll(),
    deviceTemplateRepository.findAll()
  ]);

  return { sites, assets, devices, sensors, deviceTypes, deviceTemplates };
}

export async function deviceExists(deviceId) {
  return deviceRepository.existsById(deviceId);
}

export async function getDevice(deviceId) {
  const device = await deviceRepository.findById(deviceId);
  if (!device) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }
  return device;
}
